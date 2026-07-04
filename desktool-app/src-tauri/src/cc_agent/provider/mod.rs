// provider/mod.rs — Provider 抽象层入口
// Sprint S1: Provider trait 抽象 + 各引擎实现
//
// 对齐 cc-gui 的 Provider 架构：
// - cc-gui (Java): ProviderHandler + ClaudeProviderHandler / CodexProviderHandler
// - ccagent (Rust): Provider trait + ClaudeProvider / CodexProvider
//
// 模块结构：
// - mod.rs     — trait 定义 + 工厂函数 + 模块声明
// - claude.rs  — Claude Provider 实现
// - codex.rs   — Codex Provider 实现
// - common.rs  — 共享逻辑（请求构造、响应解析）
// - mcp.rs     — MCP 服务器管理（原 provider.rs 内容）

pub mod claude;
pub mod codex;
pub mod common;
pub mod mcp;
// Sprint B7: 模型Provider验证
pub mod model_provider;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::cc_agent::types::{Engine, SessionConfig};

// ─── Provider trait 抽象 ───────────────────────────────────────────────────

/// Provider 能力描述
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCapabilities {
    /// 引擎类型
    pub engine: Engine,
    /// 是否支持流式输出
    pub supports_streaming: bool,
    /// 是否支持思考模式
    pub supports_thinking: bool,
    /// 是否支持附件（图片）
    pub supports_attachments: bool,
    /// 是否支持权限模式切换
    pub supports_permission_modes: bool,
    /// 是否支持推理强度调整
    pub supports_reasoning_effort: bool,
    /// 默认模型
    pub default_model: String,
    /// 支持的模型列表
    pub available_models: Vec<ModelInfo>,
}

/// 模型信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub label: String,
    pub context_window: Option<usize>,
    pub supports_1m_context: bool,
    pub max_output_tokens: Option<usize>,
}

/// Provider 统一接口
///
/// 每个 Provider 实现负责：
/// 1. 构造 bridge 请求参数（engine 特定的字段映射）
/// 2. 解析 bridge 响应事件（engine 特定的事件类型）
/// 3. 提供 capabilities 描述（用于前端能力发现）
#[async_trait]
pub trait Provider: Send + Sync {
    /// 引擎类型
    fn engine(&self) -> Engine;

    /// Provider 能力描述
    fn capabilities(&self) -> ProviderCapabilities;

    /// 构造发送消息的 bridge 请求参数
    ///
    /// 输入：会话配置 + 用户消息 + 会话状态
    /// 输出：bridge JSON-RPC 请求的 params 对象
    fn build_send_params(
        &self,
        config: &SessionConfig,
        message: &str,
        session_state: &SessionState,
    ) -> serde_json::Value;

    /// 解析 bridge 流式事件
    ///
    /// 输入：bridge 原始 JSON 事件
    /// 输出：标准化后的事件（content_delta / thinking_delta / tool_use / tool_result / system / error）
    fn parse_event(&self, raw: &serde_json::Value) -> Option<ProviderEvent>;

    /// 构造启动会话的额外参数
    fn build_session_args(&self, config: &SessionConfig) -> Vec<String> {
        let mut args = Vec::new();
        if let Some(model) = &config.model {
            args.push("--model".to_string());
            args.push(model.clone());
        }
        if let Some(mode) = &config.permission_mode {
            args.push("--permission-mode".to_string());
            args.push(mode.clone());
        }
        args
    }

    /// Provider 名称（用于日志和 UI 展示）
    fn name(&self) -> &'static str {
        match self.engine() {
            Engine::Claude => "Claude",
            Engine::Codex => "Codex",
        }
    }
}

/// 会话状态快照（传递给 Provider 构造请求）
#[derive(Debug, Clone)]
pub struct SessionState {
    pub claude_session_id: Option<String>,
    pub codex_thread_id: Option<String>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub streaming_enabled: bool,
    pub thinking_enabled: bool,
    pub cwd: String,
}

/// 标准化的 Provider 事件
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ProviderEvent {
    /// 内容增量
    ContentDelta { text: String },
    /// 思考增量
    ThinkingDelta { text: String },
    /// 工具调用开始
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    /// 工具调用结果
    ToolResult {
        tool_use_id: String,
        content: String,
        is_error: bool,
    },
    /// 系统事件（session_id 等）
    System { data: HashMap<String, serde_json::Value> },
    /// 错误
    Error { message: String },
    /// 使用量统计
    Usage {
        input_tokens: Option<u64>,
        output_tokens: Option<u64>,
        cache_read_tokens: Option<u64>,
        cache_create_tokens: Option<u64>,
        cost_usd: Option<f64>,
    },
    /// 流结束
    StreamEnd,
}

// ─── 工厂函数 ──────────────────────────────────────────────────────────────

/// 根据引擎类型创建 Provider 实例
pub fn create_provider(engine: Engine) -> Box<dyn Provider> {
    match engine {
        Engine::Claude => Box::new(claude::ClaudeProvider::new()),
        Engine::Codex => Box::new(codex::CodexProvider::new()),
    }
}

// ─── MCP 再导出（保持 cc_agent.rs 导入不变）─────────────────────────────────

pub use mcp::{cc_list_mcp_servers, cc_add_mcp_server, cc_remove_mcp_server, cc_get_mcp_tools};

// ─── Y3 增强：运行时配置 + Provider 状态 ────────────────────────────────────────

use std::sync::Arc;
use tokio::sync::RwLock;

/// Provider 运行时配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderRuntimeConfig {
    pub engine: Engine,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub model: String,
    pub max_tokens: u32,
    pub thinking_enabled: bool,
    pub permission_mode: String,
    pub extra_env: HashMap<String, String>,
}

impl Default for ProviderRuntimeConfig {
    fn default() -> Self {
        Self {
            engine: Engine::Claude,
            api_key: None,
            base_url: None,
            model: "claude-sonnet-4-20250514".into(),
            max_tokens: 8192,
            thinking_enabled: false,
            permission_mode: "default".into(),
            extra_env: HashMap::new(),
        }
    }
}

/// Provider 运行状态
pub struct ProviderRuntime {
    config: RwLock<ProviderRuntimeConfig>,
}

impl ProviderRuntime {
    pub fn new(config: ProviderRuntimeConfig) -> Self {
        Self { config: RwLock::new(config) }
    }

    pub fn with_defaults() -> Self {
        Self::new(ProviderRuntimeConfig::default())
    }

    pub async fn get_config(&self) -> ProviderRuntimeConfig {
        self.config.read().await.clone()
    }

    pub async fn update_config(&self, config: ProviderRuntimeConfig) {
        *self.config.write().await = config;
    }

    pub async fn set_model(&self, model: &str) {
        self.config.write().await.model = model.to_string();
    }

    pub async fn set_api_key(&self, key: Option<String>) {
        self.config.write().await.api_key = key;
    }
}

pub type SharedProviderRuntime = Arc<ProviderRuntime>;

/// 创建共享的 Provider 运行时
pub fn create_runtime() -> SharedProviderRuntime {
    Arc::new(ProviderRuntime::with_defaults())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let cfg = ProviderRuntimeConfig::default();
        assert_eq!(cfg.max_tokens, 8192);
        assert!(!cfg.thinking_enabled); // default is false
        assert!(cfg.extra_env.is_empty());
    }

    #[test]
    fn test_runtime_create() {
        let runtime = create_runtime();
        let rt = tokio::runtime::Runtime::new().unwrap();
        let config = rt.block_on(runtime.get_config());
        assert_eq!(config.max_tokens, 8192);
    }

    #[test]
    fn test_runtime_update_config() {
        let runtime = create_runtime();
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(runtime.update_config(ProviderRuntimeConfig {
            model: "gpt-5".into(),
            ..ProviderRuntimeConfig::default()
        }));
        let config = rt.block_on(runtime.get_config());
        assert_eq!(config.model, "gpt-5");
    }

    #[test]
    fn test_runtime_set_model() {
        let runtime = create_runtime();
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(runtime.set_model("claude-opus-4-20250514"));
        let config = rt.block_on(runtime.get_config());
        assert_eq!(config.model, "claude-opus-4-20250514");
    }

    #[test]
    fn test_runtime_set_api_key() {
        let runtime = create_runtime();
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(runtime.set_api_key(Some("sk-test".into())));
        let config = rt.block_on(runtime.get_config());
        assert_eq!(config.api_key.as_deref(), Some("sk-test"));
        rt.block_on(runtime.set_api_key(None));
        let config2 = rt.block_on(runtime.get_config());
        assert_eq!(config2.api_key, None);
    }

    #[test]
    fn test_create_provider() {
        let provider = create_provider(Engine::Claude);
        assert_eq!(provider.name(), "Claude");
        let provider2 = create_provider(Engine::Codex);
        assert_eq!(provider2.name(), "Codex");
    }

    #[test]
    fn test_provider_capabilities_claude() {
        let caps = ProviderCapabilities {
            engine: Engine::Claude,
            supports_streaming: true,
            supports_thinking: true,
            supports_attachments: true,
            supports_permission_modes: true,
            supports_reasoning_effort: true,
            default_model: "sonnet".into(),
            available_models: vec![],
        };
        assert!(caps.supports_streaming);
        assert!(caps.supports_thinking);
        assert!(caps.supports_reasoning_effort);
    }

    #[test]
    fn test_provider_capabilities_minimal() {
        let caps = ProviderCapabilities {
            engine: Engine::Claude,
            supports_streaming: false,
            supports_thinking: false,
            supports_attachments: false,
            supports_permission_modes: false,
            supports_reasoning_effort: false,
            default_model: "sonnet".into(),
            available_models: vec![],
        };
        assert!(!caps.supports_streaming);
        assert!(!caps.supports_attachments);
    }
}
