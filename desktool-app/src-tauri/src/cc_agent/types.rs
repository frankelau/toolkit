// types.rs — 核心类型定义
// Sprint L: 从 cc_agent.rs 拆分

use serde::{Deserialize, Serialize};
use tokio::process::Child;
use tokio::sync::Mutex;
use std::collections::HashMap;

/// Which CLI engine to use
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Engine {
    Claude,
    Codex,
}

/// Session configuration passed from frontend
#[derive(Debug, Clone, Deserialize)]
pub struct SessionConfig {
    pub engine: Engine,
    pub cwd: String,
    pub model: Option<String>,
    pub system_prompt: Option<String>,
    pub append_system_prompt: Option<String>,
    pub permission_mode: Option<String>,
    pub mcp_config: Option<String>,
    pub allowed_tools: Option<Vec<String>>,
    pub disallowed_tools: Option<Vec<String>>,
    pub effort: Option<String>,
    pub extra_args: Option<Vec<String>>,
    pub attachments: Option<Vec<Attachment>>,
    // Provider overrides
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    // Legacy toggles (still used by provider/* scaffolding)
    #[serde(default)]
    pub streaming_enabled: Option<bool>,
    #[serde(default)]
    pub thinking_enabled: Option<bool>,
    // Thinking config (JSON: {type:"adaptive"|"enabled"|"disabled", budgetTokens?, display?})
    #[serde(default)]
    pub thinking: Option<serde_json::Value>,
    // True streaming (includePartialMessages)
    #[serde(default)]
    pub include_partial_messages: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Attachment {
    #[serde(rename = "type")]
    pub att_type: String, // "image"
    pub data: String,     // base64
    pub mime_type: Option<String>,
}

/// Active session state
pub struct Session {
    pub child: Child,
    pub stdin: Option<tokio::process::ChildStdin>,
    pub engine: Engine,
    pub cwd: String,
    pub claude_session_id: Option<String>,
    pub codex_thread_id: Option<String>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub messages: Vec<serde_json::Value>,
    // Thinking config + true streaming
    pub thinking: Option<serde_json::Value>,
    pub include_partial_messages: bool,
}

/// Global session manager
pub struct SessionManager {
    pub sessions: Mutex<HashMap<String, Session>>,
}

impl Default for SessionManager {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct FileEntry {
    pub path: String,
    pub full_path: String,
    pub is_dir: bool,
    pub size: u64,
}

#[derive(Serialize)]
pub struct DependencyInfo {
    pub name: String,
    pub path: Option<String>,
    pub version: Option<String>,
    pub installed: bool,
}
