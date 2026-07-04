// permission/manager.rs — 权限管理器（完整审批链）
// 对齐 cc-gui PermissionManager（251 行）
// 审批链：工具级记忆 → 参数级记忆 → 权限模式 → 创建请求等待前端响应

use std::collections::HashMap;
use std::sync::Mutex;
use tokio::sync::oneshot;
use super::request::{PermissionRequest, PermissionResult, PermissionBehavior};
use super::service::{PermissionService, PermissionResponse};

/// 权限模式枚举（对齐 cc-gui PermissionMode）
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PermissionMode {
    /// 默认模式：每次询问
    Default,
    /// Agent 模式：自动批准文件编辑操作
    AcceptEdits,
    /// 允许所有工具调用
    AllowAll,
    /// 拒绝所有工具调用
    DenyAll,
}

impl PermissionMode {
    pub fn from_str(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "ACCEPT_EDITS" | "ACCEPT-EDITS" | "ACCEPTDEDITS" => PermissionMode::AcceptEdits,
            "ALLOW_ALL" | "ALLOW-ALL" | "ALLOWALL" => PermissionMode::AllowAll,
            "DENY_ALL" | "DENY-ALL" | "DENYALL" => PermissionMode::DenyAll,
            _ => PermissionMode::Default,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            PermissionMode::Default => "DEFAULT",
            PermissionMode::AcceptEdits => "ACCEPT_EDITS",
            PermissionMode::AllowAll => "ALLOW_ALL",
            PermissionMode::DenyAll => "DENY_ALL",
        }
    }
}

/// 编辑类工具集合（ACCEPT_EDITS 模式下自动批准）
const EDIT_TOOLS: &[&str] = &[
    "Write",
    "Edit",
    "MultiEdit",
    "CreateDirectory",
    "MoveFile",
    "CopyFile",
    "Rename",
];

/// 权限管理器（核心审批链）
pub struct PermissionManager {
    pub mode: PermissionMode,
    pending_requests: Mutex<HashMap<String, PendingEntry>>,
    /// 工具级记忆（工具名 → 是否允许）
    tool_memory: Mutex<HashMap<String, bool>>,
    /// 参数级记忆（工具名:参数哈希 → 是否允许）
    param_memory: Mutex<HashMap<String, bool>>,
}

struct PendingEntry {
    request: PermissionRequest,
    sender: oneshot::Sender<PermissionResult>,
}

impl PermissionManager {
    pub fn new() -> Self {
        Self {
            mode: PermissionMode::Default,
            pending_requests: Mutex::new(HashMap::new()),
            tool_memory: Mutex::new(HashMap::new()),
            param_memory: Mutex::new(HashMap::new()),
        }
    }

    /// 设置权限模式
    pub fn set_mode(&mut self, mode: &str) {
        self.mode = PermissionMode::from_str(mode);
        eprintln!("Permission mode set to: {:?}", self.mode);
    }

    /// 清除所有记忆，返回 (param_size, tool_size)
    pub fn clear_memory(&mut self) -> (usize, usize) {
        let (param_size, tool_size) = {
            let p = self.param_memory.lock().map(|m| m.len()).unwrap_or(0);
            let t = self.tool_memory.lock().map(|m| m.len()).unwrap_or(0);
            (p, t)
        };
        if let Ok(mut m) = self.param_memory.lock() {
            m.clear();
        }
        if let Ok(mut m) = self.tool_memory.lock() {
            m.clear();
        }
        (param_size, tool_size)
    }

    /// 清除指定工具的记忆
    pub fn clear_tool_memory(&self, tool_name: &str) {
        if let Ok(mut m) = self.param_memory.lock() {
            m.retain(|k, _| !k.starts_with(&format!("{}:", tool_name)));
        }
        if let Ok(mut m) = self.tool_memory.lock() {
            m.remove(tool_name);
        }
    }

    /// 核心审批方法：检查是否需要弹窗
    ///
    /// 审批链：
    /// 1. 工具级记忆 → 直接返回
    /// 2. 参数级记忆 → 直接返回
    /// 3. ACCEPT_EDITS 模式 → 编辑工具自动批准
    /// 4. ALLOW_ALL → 批准
    /// 5. DENY_ALL → 拒绝
    /// 6. 创建请求 → 等待前端响应
    pub async fn check_permission(
        &self,
        channel_id: &str,
        tool_name: &str,
        inputs: serde_json::Value,
    ) -> PermissionResult {
        // 1. 工具级记忆
        if let Ok(memory) = self.tool_memory.lock() {
            if let Some(&allow) = memory.get(tool_name) {
                return if allow {
                    PermissionResult::allow(None)
                } else {
                    PermissionResult::deny("Previously denied by user", true)
                };
            }
        }

        // 2. 参数级记忆
        let memory_key = build_memory_key(tool_name, &inputs);
        if let Ok(memory) = self.param_memory.lock() {
            if let Some(&allow) = memory.get(&memory_key) {
                return if allow {
                    PermissionResult::allow(None)
                } else {
                    PermissionResult::deny("Previously denied by user", true)
                };
            }
        }

        // 3. ACCEPT_EDITS 模式
        if self.mode == PermissionMode::AcceptEdits {
            if is_edit_tool(tool_name) && is_path_in_workspace(&inputs) {
                return PermissionResult::allow(None);
            }
        }

        // 4. ALLOW_ALL
        if self.mode == PermissionMode::AllowAll {
            return PermissionResult::allow(None);
        }

        // 5. DENY_ALL
        if self.mode == PermissionMode::DenyAll {
            return PermissionResult::deny("Denied by global permission mode", true);
        }

        // 6. 创建请求，等待前端响应
        self.create_pending_request(channel_id, tool_name, inputs).await
    }

    /// 创建待处理请求，等待前端响应
    async fn create_pending_request(
        &self,
        channel_id: &str,
        tool_name: &str,
        inputs: serde_json::Value,
    ) -> PermissionResult {
        let request = PermissionRequest::new(channel_id, tool_name, inputs.clone(), None);
        let (tx, rx) = oneshot::channel();

        let entry = PendingEntry {
            request: request.clone(),
            sender: tx,
        };

        if let Ok(mut pending) = self.pending_requests.lock() {
            pending.insert(request.request_id.clone(), entry);
        }

        eprintln!(
            "Permission request created: id={}, tool={}, waiting for frontend response",
            request.request_id,
            tool_name
        );

        // 等待前端响应（带 5 分钟超时）
        match tokio::time::timeout(std::time::Duration::from_secs(300), rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => {
                // sender 被丢弃
                if let Ok(mut pending) = self.pending_requests.lock() {
                    pending.remove(&request.request_id);
                }
                PermissionResult::deny("Permission request channel closed", true)
            }
            Err(_) => {
                // 超时
                if let Ok(mut pending) = self.pending_requests.lock() {
                    pending.remove(&request.request_id);
                }
                PermissionResult::deny("Permission request timed out", true)
            }
        }
    }

    /// 前端响应权限请求
    pub async fn respond(
        &self,
        request_id: &str,
        response: &str,
        updated_input: Option<serde_json::Value>,
    ) -> Result<bool, String> {
        let entry = {
            let mut pending = self
                .pending_requests
                .lock()
                .map_err(|e| e.to_string())?;
            pending.remove(request_id)
        };

        let entry = match entry {
            Some(e) => e,
            None => {
                eprintln!(
                    "Permission request not found or already resolved: {}",
                    request_id
                );
                return Ok(false);
            }
        };

        let result = match response.to_uppercase().as_str() {
            "ALLOW" | "ALLOW_ONCE" | "1" => {
                if let Ok(mut m) = self.param_memory.lock() {
                    let key = build_memory_key(&entry.request.tool_name, &entry.request.inputs);
                    m.insert(key, true);
                }
                PermissionResult::allow(updated_input)
            }
            "ALLOW_ALWAYS" | "ALLOWALWAYS" | "2" => {
                if let Ok(mut m) = self.tool_memory.lock() {
                    m.insert(entry.request.tool_name.clone(), true);
                }
                PermissionResult::allow(updated_input)
            }
            "DENY" | "3" => PermissionResult::deny("Denied by user", true),
            _ => PermissionResult::deny("Unknown response", true),
        };

        let _ = entry.sender.send(result);
        Ok(true)
    }

    /// 列出所有待处理请求（供前端轮询）
    pub fn list_pending(&self) -> Vec<serde_json::Value> {
        if let Ok(pending) = self.pending_requests.lock() {
            pending
                .values()
                .map(|e| e.request.to_json())
                .collect()
        } else {
            vec![]
        }
    }

    /// 取消所有待处理请求
    pub fn cancel_all_pending(&self) {
        if let Ok(mut pending) = self.pending_requests.lock() {
            for (_, entry) in pending.drain() {
                let _ = entry
                    .sender
                    .send(PermissionResult::deny("All requests cancelled", true));
            }
        }
    }
}

impl Default for PermissionManager {
    fn default() -> Self {
        Self::new()
    }
}

/// 构建参数级记忆 key
fn build_memory_key(tool_name: &str, inputs: &serde_json::Value) -> String {
    format!("{}:{}", tool_name, inputs)
}

/// 判断是否为编辑类工具
fn is_edit_tool(tool_name: &str) -> bool {
    EDIT_TOOLS.contains(&tool_name)
}

/// 判断文件路径是否在工作区内（基础版：有 file_path/path 即允许）
/// 注：完整版需要 workspace 路径校验，这里做简化适配
fn is_path_in_workspace(inputs: &serde_json::Value) -> bool {
    if let Some(obj) = inputs.as_object() {
        return obj.contains_key("file_path") || obj.contains_key("path");
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_permission_mode_from_str() {
        assert_eq!(
            PermissionMode::from_str("ACCEPT_EDITS"),
            PermissionMode::AcceptEdits
        );
        assert_eq!(
            PermissionMode::from_str("allow_all"),
            PermissionMode::AllowAll
        );
        assert_eq!(PermissionMode::from_str("default"), PermissionMode::Default);
    }

    #[test]
    fn test_is_edit_tool() {
        assert!(is_edit_tool("Write"));
        assert!(is_edit_tool("Edit"));
        assert!(is_edit_tool("MultiEdit"));
        assert!(!is_edit_tool("Bash"));
        assert!(!is_edit_tool("Read"));
    }

    #[test]
    fn test_tool_memory() {
        let manager = PermissionManager::new();
        if let Ok(mut m) = manager.tool_memory.lock() {
            m.insert("Bash".to_string(), true);
        }
        // 验证记忆存在
        let memory = manager.tool_memory.lock().unwrap();
        assert_eq!(memory.get("Bash"), Some(&true));
    }

    #[test]
    fn test_clear_memory() {
        let mut manager = PermissionManager::new();
        if let Ok(mut m) = manager.param_memory.lock() {
            m.insert("Bash:{}".to_string(), true);
        }
        if let Ok(mut m) = manager.tool_memory.lock() {
            m.insert("Read".to_string(), true);
        }
        let (p, t) = manager.clear_memory();
        assert_eq!(p, 1);
        assert_eq!(t, 1);
        assert!(manager.param_memory.lock().unwrap().is_empty());
        assert!(manager.tool_memory.lock().unwrap().is_empty());
    }
}
