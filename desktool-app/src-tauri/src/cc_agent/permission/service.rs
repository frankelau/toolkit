// permission/service.rs — 权限服务（请求处理 + 文件协议 + 会话管理）
// 对齐 cc-gui PermissionService（632 行）

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::fs;
use super::decision_store::PermissionDecisionStore;

/// 权限响应枚举（对齐 cc-gui PermissionResponse）
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PermissionResponse {
    /// 允许一次
    Allow,
    /// 允许并记住（不再询问）
    AllowAlways,
    /// 拒绝
    Deny,
}

impl PermissionResponse {
    pub fn value(&self) -> i32 {
        match self {
            PermissionResponse::Allow => 1,
            PermissionResponse::AllowAlways => 2,
            PermissionResponse::Deny => 3,
        }
    }

    pub fn from_value(v: i32) -> Option<Self> {
        match v {
            1 => Some(PermissionResponse::Allow),
            2 => Some(PermissionResponse::AllowAlways),
            3 => Some(PermissionResponse::Deny),
            _ => None,
        }
    }

    pub fn description(&self) -> &'static str {
        match self {
            PermissionResponse::Allow => "Allow",
            PermissionResponse::AllowAlways => "Allow and don't ask again",
            PermissionResponse::Deny => "Deny",
        }
    }

    pub fn is_allow(&self) -> bool {
        matches!(self, PermissionResponse::Allow | PermissionResponse::AllowAlways)
    }
}

/// 权限决策（工具名 + 输入 + 响应）
#[derive(Debug, Clone)]
pub struct PermissionDecision {
    pub tool_name: String,
    pub inputs: serde_json::Value,
    pub response: PermissionResponse,
}

impl PermissionDecision {
    pub fn is_allowed(&self) -> bool {
        self.response.is_allow()
    }
}

/// 权限服务实例（每个会话一个）
pub struct PermissionService {
    pub session_id: String,
    pub permission_dir: PathBuf,
    pub decision_store: PermissionDecisionStore,
    pub last_activity_time: Arc<Mutex<u64>>,
}

impl PermissionService {
    pub fn new(session_id: impl Into<String>) -> Self {
        let session_id = session_id.into();
        let permission_dir = get_permission_dir();
        // 确保目录存在
        let _ = std::fs::create_dir_all(&permission_dir);

        Self {
            session_id,
            permission_dir,
            decision_store: PermissionDecisionStore::new(),
            last_activity_time: Arc::new(Mutex::new(now_secs())),
        }
    }

    pub fn touch_activity(&self) {
        if let Ok(mut t) = self.last_activity_time.lock() {
            *t = now_secs();
        }
    }

    pub fn get_last_activity_time(&self) -> u64 {
        self.last_activity_time.lock().map(|t| *t).unwrap_or(0)
    }

    /// 清除决策记忆
    pub fn clear_decision_memory(&self) -> (usize, usize) {
        let param = self.decision_store.parameter_memory_size();
        let tool = self.decision_store.tool_memory_size();
        self.decision_store.clear();
        (param, tool)
    }

    /// 检查是否有记住的决策
    pub fn check_remembered_decision(
        &self,
        tool_name: &str,
        inputs: &serde_json::Value,
    ) -> Option<PermissionResponse> {
        // 先查工具级
        if let Some(resp) = self.decision_store.get_tool_decision(tool_name) {
            return Some(resp);
        }
        // 再查参数级
        self.decision_store.get_parameter_decision(tool_name, inputs)
    }

    /// 记住决策
    pub fn remember_decision(
        &self,
        tool_name: &str,
        inputs: &serde_json::Value,
        response: PermissionResponse,
    ) {
        match response {
            PermissionResponse::AllowAlways => {
                self.decision_store
                    .remember_tool_decision(tool_name, response);
            }
            PermissionResponse::Allow | PermissionResponse::Deny => {
                self.decision_store
                    .remember_parameter_decision(tool_name, inputs, response);
            }
        }
    }

    /// 写入权限请求文件（供 CLI 子进程读取）
    pub async fn write_request_file(
        &self,
        request_id: &str,
        tool_name: &str,
        inputs: &serde_json::Value,
    ) -> std::io::Result<PathBuf> {
        let file_name = format!("{}_{}.json", self.session_id, request_id);
        let path = self.permission_dir.join(&file_name);
        let content = serde_json::json!({
            "sessionId": self.session_id,
            "requestId": request_id,
            "toolName": tool_name,
            "inputs": inputs,
            "timestamp": now_millis(),
        });
        fs::write(&path, content.to_string()).await?;
        Ok(path)
    }

    /// 写入权限响应文件（用户决策后）
    pub async fn write_response_file(
        &self,
        request_id: &str,
        response: PermissionResponse,
        updated_input: Option<&serde_json::Value>,
    ) -> std::io::Result<PathBuf> {
        let file_name = format!("{}_{}_response.json", self.session_id, request_id);
        let path = self.permission_dir.join(&file_name);
        let content = serde_json::json!({
            "sessionId": self.session_id,
            "requestId": request_id,
            "response": response.value(),
            "responseDescription": response.description(),
            "updatedInput": updated_input,
            "timestamp": now_millis(),
        });
        fs::write(&path, content.to_string()).await?;
        Ok(path)
    }

    /// 读取权限响应文件（轮询 CLI 是否已处理）
    pub async fn read_response_file(&self, request_id: &str) -> Option<serde_json::Value> {
        let file_name = format!("{}_{}_response.json", self.session_id, request_id);
        let path = self.permission_dir.join(&file_name);
        let content = fs::read_to_string(&path).await.ok()?;
        serde_json::from_str(&content).ok()
    }

    /// 清理请求/响应文件
    pub async fn cleanup_request_files(&self, request_id: &str) {
        let req_file = self
            .permission_dir
            .join(format!("{}_{}.json", self.session_id, request_id));
        let resp_file = self
            .permission_dir
            .join(format!("{}_{}_response.json", self.session_id, request_id));
        let _ = fs::remove_file(&req_file).await;
        let _ = fs::remove_file(&resp_file).await;
    }

    /// 停止服务（清理资源）
    pub fn stop(&self) {
        // Rust 版无后台线程需停止，文件清理按需进行
    }
}

/// 获取权限目录（环境变量优先，回退到 tmp）
fn get_permission_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("CLAUDE_PERMISSION_DIR") {
        if !dir.trim().is_empty() {
            return PathBuf::from(dir);
        }
    }
    std::env::temp_dir().join("claude-permission")
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_permission_response_value() {
        assert_eq!(PermissionResponse::Allow.value(), 1);
        assert_eq!(PermissionResponse::AllowAlways.value(), 2);
        assert_eq!(PermissionResponse::Deny.value(), 3);
    }

    #[test]
    fn test_permission_response_from_value() {
        assert_eq!(
            PermissionResponse::from_value(1),
            Some(PermissionResponse::Allow)
        );
        assert_eq!(PermissionResponse::from_value(99), None);
    }

    #[test]
    fn test_is_allow() {
        assert!(PermissionResponse::Allow.is_allow());
        assert!(PermissionResponse::AllowAlways.is_allow());
        assert!(!PermissionResponse::Deny.is_allow());
    }

    #[test]
    fn test_service_remembered_decision() {
        let svc = PermissionService::new("test-session");
        let inputs = serde_json::json!({"command": "ls"});
        assert!(svc
            .check_remembered_decision("Bash", &inputs)
            .is_none());

        svc.remember_decision("Bash", &inputs, PermissionResponse::Allow);
        assert_eq!(
            svc.check_remembered_decision("Bash", &inputs),
            Some(PermissionResponse::Allow)
        );

        // AllowAlways 记在工具级
        svc.remember_decision("Read", &inputs, PermissionResponse::AllowAlways);
        assert_eq!(
            svc.check_remembered_decision("Read", &inputs),
            Some(PermissionResponse::AllowAlways)
        );
        // 不同参数也命中工具级
        let inputs2 = serde_json::json!({"file": "other.txt"});
        assert_eq!(
            svc.check_remembered_decision("Read", &inputs2),
            Some(PermissionResponse::AllowAlways)
        );
    }
}
