// provider/claude.rs — Claude Provider 实现
// Sprint S1: Claude 引擎的 Provider trait 实现

use async_trait::async_trait;
use std::collections::HashMap;

use crate::cc_agent::provider::{
    ModelInfo, Provider, ProviderCapabilities, ProviderEvent, SessionState,
};
use crate::cc_agent::types::{Engine, SessionConfig};

/// Claude Provider
///
/// 负责构造 Claude Code CLI 的 bridge 请求参数，
/// 并解析 Claude 流式 API 的事件格式。
pub struct ClaudeProvider;

impl ClaudeProvider {
    pub fn new() -> Self {
        Self
    }
}

impl Default for ClaudeProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for ClaudeProvider {
    fn engine(&self) -> Engine {
        Engine::Claude
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            engine: Engine::Claude,
            supports_streaming: true,
            supports_thinking: true,
            supports_attachments: true,
            supports_permission_modes: true,
            supports_reasoning_effort: false,
            default_model: "sonnet".to_string(),
            available_models: vec![
                ModelInfo {
                    id: "sonnet".to_string(),
                    label: "Sonnet".to_string(),
                    context_window: Some(200_000),
                    supports_1m_context: true,
                    max_output_tokens: Some(16_384),
                },
                ModelInfo {
                    id: "opus".to_string(),
                    label: "Opus".to_string(),
                    context_window: Some(200_000),
                    supports_1m_context: true,
                    max_output_tokens: Some(32_768),
                },
                ModelInfo {
                    id: "haiku".to_string(),
                    label: "Haiku".to_string(),
                    context_window: Some(200_000),
                    supports_1m_context: false,
                    max_output_tokens: Some(8_192),
                },
            ],
        }
    }

    fn build_send_params(
        &self,
        _config: &SessionConfig,
        message: &str,
        session_state: &SessionState,
    ) -> serde_json::Value {
        serde_json::json!({
            "engine": "claude",
            "message": message,
            "cwd": session_state.cwd,
            "sessionId": session_state.claude_session_id,
            "threadId": null,
            "baseUrl": session_state.base_url,
            "apiKey": session_state.api_key,
            "streamingEnabled": session_state.streaming_enabled,
            "thinkingEnabled": session_state.thinking_enabled,
        })
    }

    fn parse_event(&self, raw: &serde_json::Value) -> Option<ProviderEvent> {
        let msg_type = raw.get("type").and_then(|v| v.as_str())?;

        match msg_type {
            "stream" => {
                let data = raw.get("data")?;
                let data_type = data.get("type").and_then(|v| v.as_str()).unwrap_or("");

                match data_type {
                    "text" | "content_block_delta" => {
                        let text = data
                            .get("text")
                            .or_else(|| data.get("delta").and_then(|d| d.get("text")))
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        if text.is_empty() {
                            None
                        } else {
                            Some(ProviderEvent::ContentDelta { text: text.to_string() })
                        }
                    }
                    "thinking" => {
                        let text = data
                            .get("text")
                            .or_else(|| data.get("delta").and_then(|d| d.get("thinking")))
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        Some(ProviderEvent::ThinkingDelta { text: text.to_string() })
                    }
                    "tool_use" | "tool_call" => {
                        let id = data
                            .get("id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let name = data
                            .get("name")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let input = data.get("input").cloned().unwrap_or(serde_json::json!({}));
                        Some(ProviderEvent::ToolUse { id, name, input })
                    }
                    "tool_result" => {
                        let tool_use_id = data
                            .get("tool_use_id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let content = data
                            .get("content")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let is_error = data
                            .get("is_error")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false);
                        Some(ProviderEvent::ToolResult {
                            tool_use_id,
                            content,
                            is_error,
                        })
                    }
                    "system" => {
                        let mut map = HashMap::new();
                        if let Some(sid) = data.get("session_id") {
                            map.insert("session_id".to_string(), sid.clone());
                        }
                        if let Some(obj) = data.as_object() {
                            for (k, v) in obj {
                                if k != "type" {
                                    map.insert(k.clone(), v.clone());
                                }
                            }
                        }
                        Some(ProviderEvent::System { data: map })
                    }
                    "usage" => {
                        Some(ProviderEvent::Usage {
                            input_tokens: data.get("input_tokens").and_then(|v| v.as_u64()),
                            output_tokens: data.get("output_tokens").and_then(|v| v.as_u64()),
                            cache_read_tokens: data
                                .get("cache_read_tokens")
                                .and_then(|v| v.as_u64()),
                            cache_create_tokens: data
                                .get("cache_creation_tokens")
                                .and_then(|v| v.as_u64()),
                            cost_usd: data.get("cost_usd").and_then(|v| v.as_f64()),
                        })
                    }
                    _ => None,
                }
            }
            "stream_end" | "result" if msg_type == "stream_end" => Some(ProviderEvent::StreamEnd),
            "result" => {
                // Claude result event may carry usage info
                if let Some(usage) = raw.get("usage") {
                    Some(ProviderEvent::Usage {
                        input_tokens: usage.get("input_tokens").and_then(|v| v.as_u64()),
                        output_tokens: usage.get("output_tokens").and_then(|v| v.as_u64()),
                        cache_read_tokens: usage
                            .get("cache_read_tokens")
                            .and_then(|v| v.as_u64()),
                        cache_create_tokens: usage
                            .get("cache_creation_tokens")
                            .and_then(|v| v.as_u64()),
                        cost_usd: usage.get("cost_usd").and_then(|v| v.as_f64()),
                    })
                } else {
                    Some(ProviderEvent::StreamEnd)
                }
            }
            "error" => {
                let message = raw
                    .get("message")
                    .or_else(|| raw.get("error"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown error")
                    .to_string();
                Some(ProviderEvent::Error { message })
            }
            _ => None,
        }
    }

    fn build_session_args(&self, config: &SessionConfig) -> Vec<String> {
        let mut args = Vec::new();

        // Model
        if let Some(model) = &config.model {
            args.push("--model".to_string());
            args.push(model.clone());
        }

        // Permission mode
        if let Some(mode) = &config.permission_mode {
            args.push("--permission-mode".to_string());
            args.push(mode.clone());
        }

        // MCP config
        if let Some(mcp) = &config.mcp_config {
            args.push("--mcp-config".to_string());
            args.push(mcp.clone());
        }

        // Allowed tools
        if let Some(tools) = &config.allowed_tools {
            for tool in tools {
                args.push("--allowed-tools".to_string());
                args.push(tool.clone());
            }
        }

        // Streaming / thinking
        if config.streaming_enabled == Some(false) {
            args.push("--no-stream".to_string());
        }
        if config.thinking_enabled == Some(true) {
            args.push("--thinking".to_string());
        }

        args
    }
}
