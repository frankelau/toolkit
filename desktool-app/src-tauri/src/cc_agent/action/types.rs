// action/types.rs — Action 类型定义
// 对齐 cc-gui AnAction 框架模式，适配 Tauri 后端

use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};

/// Action 类别
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ActionKind {
    // 会话操作
    StartSession,
    SendMessage,
    AbortSession,
    SwitchTab,
    ListTabs,

    // 消息处理
    ProcessMessage,
    ProcessStreamLine,
    ProcessError,
    EnhancePrompt,

    // 工具调用
    ExecuteToolCall,
    ApproveToolCall,
    RejectToolCall,
    ToolResult,

    // 文件操作
    ListFiles,
    ReadFile,
    GetFileDiff,
    UndoFile,
    DiscardFiles,

    // 权限
    RequestPermission,
    RespondPermission,
    SetPermissionMode,

    // 终端
    ExecuteTerminal,
    StartTerminal,
    KillTerminal,

    // 上下文
    GetHistory,
    GetContextUsage,
    SearchSessions,

    // 配置
    GetSettings,
    SaveSettings,
    GetProjectConfig,
    SaveProjectConfig,

    // Skill
    ListSkills,
    CreateSkill,
    DeleteSkill,
    ImportSkill,
    EnableSkill,
    DisableSkill,

    // Provider/MCP
    ListMcpServers,
    AddMcpServer,
    RemoveMcpServer,
    GetMcpTools,

    // 缓存
    ClearCache,
    CacheStats,

    // Bridge
    EnsureBridge,
    BridgeHealth,
    BridgeCommand,

    // 其他
    Rewind,
    PlanResponse,
    AskUserResponse,
    ConvertCodex,

    // 内部
    Noop,
    Custom(String),
}

/// Action 执行状态
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ActionStatus {
    Pending,
    Running,
    Completed,
    Failed(String),
    Cancelled,
    Skipped,
}

/// Action 请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionRequest {
    pub id: String,
    pub kind: ActionKind,
    pub payload: serde_json::Value,
    pub session_id: Option<String>,
    pub timestamp: u128,
    pub timeout_ms: Option<u64>,
    pub priority: ActionPriority,
}

/// Action 结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionResult {
    pub request_id: String,
    pub status: ActionStatus,
    pub data: Option<serde_json::Value>,
    pub error: Option<String>,
    pub duration_ms: u64,
    pub metadata: Option<serde_json::Value>,
}

/// Action 优先级
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum ActionPriority {
    Low = 0,
    Normal = 5,
    High = 8,
    Critical = 10,
}

impl Default for ActionPriority {
    fn default() -> Self {
        Self::Normal
    }
}

impl Default for ActionRequest {
    fn default() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            kind: ActionKind::Noop,
            payload: serde_json::Value::Null,
            session_id: None,
            timestamp: super::super::util::time_utils::now_millis(),
            timeout_ms: Some(30_000),
            priority: ActionPriority::Normal,
        }
    }
}

impl ActionResult {
    pub fn ok(request_id: String, data: Option<serde_json::Value>, duration: Duration) -> Self {
        Self {
            request_id,
            status: ActionStatus::Completed,
            data,
            error: None,
            duration_ms: duration.as_millis() as u64,
            metadata: None,
        }
    }

    pub fn err(request_id: String, error: String, duration: Duration) -> Self {
        Self {
            request_id,
            status: ActionStatus::Failed(error.clone()),
            data: None,
            error: Some(error),
            duration_ms: duration.as_millis() as u64,
            metadata: None,
        }
    }

    pub fn is_success(&self) -> bool {
        matches!(self.status, ActionStatus::Completed)
    }
}
