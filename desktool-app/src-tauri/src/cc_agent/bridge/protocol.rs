// bridge/protocol.rs — bridge 通信协议定义
// Sprint V3: 定义 bridge 请求/响应的标准化类型

use serde::{Deserialize, Serialize};

/// bridge 支持的方法
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BridgeMethod {
    Send,
    Abort,
    PermissionResponse,
    GetContextUsage,
    SetPermissionMode,
    EnhancePrompt,
    ListMcpServers,
    AddMcpServer,
    RemoveMcpServer,
    GetMcpTools,
}

impl BridgeMethod {
    pub fn as_str(&self) -> &'static str {
        match self {
            BridgeMethod::Send => "send",
            BridgeMethod::Abort => "abort",
            BridgeMethod::PermissionResponse => "permission_response",
            BridgeMethod::GetContextUsage => "get_context_usage",
            BridgeMethod::SetPermissionMode => "set_permission_mode",
            BridgeMethod::EnhancePrompt => "enhance_prompt",
            BridgeMethod::ListMcpServers => "list_mcp_servers",
            BridgeMethod::AddMcpServer => "add_mcp_server",
            BridgeMethod::RemoveMcpServer => "remove_mcp_server",
            BridgeMethod::GetMcpTools => "get_mcp_tools",
        }
    }
}

/// bridge 请求（发送到子进程 stdin）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeRequest {
    pub id: String,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

impl BridgeRequest {
    pub fn new(method: impl Into<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            method: method.into(),
            params: None,
        }
    }

    pub fn with_params(mut self, params: serde_json::Value) -> Self {
        self.params = Some(params);
        self
    }

    /// 序列化为 NDJSON 行（带换行符）
    pub fn to_line(&self) -> String {
        format!("{}\n", serde_json::to_string(self).unwrap_or_default())
    }
}

/// bridge 响应事件类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeResponse {
    #[serde(rename = "type")]
    pub msg_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thread_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl BridgeResponse {
    pub fn is_stream(&self) -> bool {
        self.msg_type == "stream"
    }

    pub fn is_result(&self) -> bool {
        self.msg_type == "result"
    }

    pub fn is_error(&self) -> bool {
        self.msg_type == "error" || self.error.is_some()
    }

    pub fn is_stream_end(&self) -> bool {
        self.msg_type == "stream_end"
    }

    pub fn is_daemon(&self) -> bool {
        self.msg_type == "daemon"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bridge_request_to_line() {
        let req = BridgeRequest::new("send").with_params(serde_json::json!({"message": "hi"}));
        let line = req.to_line();
        assert!(line.ends_with('\n'));
        assert!(line.contains("\"method\":\"send\""));
        assert!(line.contains("\"message\":\"hi\""));
    }

    #[test]
    fn test_bridge_response_type_checks() {
        let stream = BridgeResponse {
            msg_type: "stream".to_string(),
            data: None,
            thread_id: None,
            error: None,
        };
        assert!(stream.is_stream());
        assert!(!stream.is_result());

        let err = BridgeResponse {
            msg_type: "error".to_string(),
            data: None,
            thread_id: None,
            error: Some("oops".to_string()),
        };
        assert!(err.is_error());
    }

    #[test]
    fn test_bridge_method_as_str() {
        assert_eq!(BridgeMethod::Send.as_str(), "send");
        assert_eq!(BridgeMethod::Abort.as_str(), "abort");
        assert_eq!(BridgeMethod::PermissionResponse.as_str(), "permission_response");
    }
}
