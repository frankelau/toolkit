// permission/request.rs — 权限请求与结果类型
// 对齐 cc-gui PermissionRequest + PermissionResult

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::oneshot;

/// 权限行为枚举
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PermissionBehavior {
    Allow,
    Deny,
}

/// 权限结果
#[derive(Debug, Clone)]
pub struct PermissionResult {
    pub behavior: PermissionBehavior,
    pub updated_input: Option<serde_json::Value>,
    pub updated_permissions: Option<serde_json::Value>,
    pub message: Option<String>,
    pub interrupt: bool,
}

impl PermissionResult {
    pub fn allow(updated_input: Option<serde_json::Value>) -> Self {
        Self {
            behavior: PermissionBehavior::Allow,
            updated_input,
            updated_permissions: None,
            message: None,
            interrupt: false,
        }
    }

    pub fn deny(message: impl Into<String>, interrupt: bool) -> Self {
        Self {
            behavior: PermissionBehavior::Deny,
            updated_input: None,
            updated_permissions: None,
            message: Some(message.into()),
            interrupt,
        }
    }

    pub fn is_allowed(&self) -> bool {
        self.behavior == PermissionBehavior::Allow
    }
}

/// 权限请求
#[derive(Debug, Clone)]
pub struct PermissionRequest {
    pub request_id: String,
    pub channel_id: String,
    pub tool_name: String,
    pub inputs: serde_json::Value,
    pub suggestions: Option<serde_json::Value>,
    pub created_at: u64,
}

impl PermissionRequest {
    pub fn new(
        channel_id: impl Into<String>,
        tool_name: impl Into<String>,
        inputs: serde_json::Value,
        suggestions: Option<serde_json::Value>,
    ) -> Self {
        let request_id = format!(
            "perm-{}-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0),
            rand_u32()
        );
        Self {
            request_id,
            channel_id: channel_id.into(),
            tool_name: tool_name.into(),
            inputs,
            suggestions,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
        }
    }

    /// 序列化为前端可消费的 JSON
    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "requestId": self.request_id,
            "channelId": self.channel_id,
            "toolName": self.tool_name,
            "inputs": self.inputs,
            "suggestions": self.suggestions,
            "createdAt": self.created_at,
        })
    }
}

/// 简单的随机数生成（避免引入 rand 依赖）
fn rand_u32() -> u32 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    std::time::Instant::now().hash(&mut hasher);
    std::thread::current().id().hash(&mut hasher);
    (hasher.finish() & 0xFFFFFFFF) as u32
}

/// 响应通道（请求创建时生成，用户响应时完成）
pub type ResponseSender = oneshot::Sender<PermissionResult>;
pub type ResponseReceiver = oneshot::Receiver<PermissionResult>;

/// 带响应通道的待处理请求
pub struct PendingRequest {
    pub request: PermissionRequest,
    pub sender: ResponseSender,
}

impl PendingRequest {
    pub fn new(request: PermissionRequest, sender: ResponseSender) -> Self {
        Self { request, sender }
    }
}

/// 安全的待处理请求共享引用
pub type SharedPendingRequest = Arc<tokio::sync::Mutex<Option<PendingRequest>>>;
