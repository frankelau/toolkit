// provider/codex.rs — Codex Provider 实现
// Sprint S1: Codex 引擎的 Provider trait 实现

use async_trait::async_trait;
use std::collections::HashMap;

use crate::cc_agent::provider::{
    ModelInfo, Provider, ProviderCapabilities, ProviderEvent, SessionState,
};
use crate::cc_agent::types::{Engine, SessionConfig};

/// Codex Provider
///
/// 负责构造 Codex CLI 的 bridge 请求参数，
/// 并解析 OpenAI/Codex 流式 API 的事件格式。
pub struct CodexProvider;

impl CodexProvider {
    pub fn new() -> Self {
        Self
    }
}

impl Default for CodexProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for CodexProvider {
    fn engine(&self) -> Engine {
        Engine::Codex
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            engine: Engine::Codex,
            supports_streaming: true,
            supports_thinking: false,
            supports_attachments: true,
            supports_permission_modes: true,
            supports_reasoning_effort: true,
            default_model: "o3".to_string(),
            available_models: vec![
                ModelInfo {
                    id: "o3".to_string(),
                    label: "o3".to_string(),
                    context_window: Some(128_000),
                    supports_1m_context: false,
                    max_output_tokens: Some(16_384),
                },
                ModelInfo {
                    id: "o4-mini".to_string(),
                    label: "o4-mini".to_string(),
                    context_window: Some(128_000),
                    supports_1m_context: false,
                    max_output_tokens: Some(16_384),
                },
                ModelInfo {
                    id: "gpt-4.1".to_string(),
                    label: "GPT-4.1".to_string(),
                    context_window: Some(1_000_000),
                    supports_1m_context: true,
                    max_output_tokens: Some(32_768),
                },
            ],
        }
    }

    fn build_send_params(
        &self,
        config: &SessionConfig,
        message: &str,
        session_state: &SessionState,
    ) -> serde_json::Value {
        serde_json::json!({
            "engine": "codex",
            "message": message,
            "cwd": session_state.cwd,
            "sessionId": null,
            "threadId": session_state.codex_thread_id,
            "baseUrl": session_state.base_url,
            "apiKey": session_state.api_key,
            "streamingEnabled": session_state.streaming_enabled,
            "thinkingEnabled": false, // Codex 不支持思考模式
            "effort": config.effort,
        })
    }

    fn parse_event(&self, raw: &serde_json::Value) -> Option<ProviderEvent> {
        let msg_type = raw.get("type").and_then(|v| v.as_str())?;

        match msg_type {
            "stream" => {
                let data = raw.get("data")?;
                let data_type = data.get("type").and_then(|v| v.as_str()).unwrap_or("");

                match data_type {
                    "text" | "content_block_delta" | "delta" => {
                        let text = data
                            .get("text")
                            .or_else(|| data.get("delta").and_then(|d| d.get("content")))
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        if text.is_empty() {
                            None
                        } else {
                            Some(ProviderEvent::ContentDelta { text: text.to_string() })
                        }
                    }
                    "tool_call" | "function_call" => {
                        let id = data
                            .get("id")
                            .or_else(|| data.get("call_id"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let name = data
                            .get("name")
                            .or_else(|| data.get("function").and_then(|f| f.get("name")))
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let input = data
                            .get("arguments")
                            .or_else(|| data.get("input"))
                            .and_then(|v| v.as_str())
                            .and_then(|s| serde_json::from_str(s).ok())
                            .unwrap_or(data.get("input").cloned().unwrap_or(serde_json::json!({})));
                        Some(ProviderEvent::ToolUse { id, name, input })
                    }
                    "tool_result" | "function_call_output" => {
                        let tool_use_id = data
                            .get("tool_use_id")
                            .or_else(|| data.get("call_id"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let content = data
                            .get("content")
                            .or_else(|| data.get("output"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        Some(ProviderEvent::ToolResult {
                            tool_use_id,
                            content,
                            is_error: false,
                        })
                    }
                    "system" => {
                        let mut map = HashMap::new();
                        if let Some(tid) = data.get("threadId").or_else(|| data.get("thread_id")) {
                            map.insert("threadId".to_string(), tid.clone());
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
                                .get("prompt_tokens_details")
                                .and_then(|d| d.get("cached_tokens"))
                                .and_then(|v| v.as_u64()),
                            cache_create_tokens: None,
                            cost_usd: data.get("cost_usd").and_then(|v| v.as_f64()),
                        })
                    }
                    _ => None,
                }
            }
            "stream_end" => Some(ProviderEvent::StreamEnd),
            "result" => {
                // Codex result carries threadId
                if let Some(thread_id) = raw.get("threadId") {
                    let mut map = HashMap::new();
                    map.insert("threadId".to_string(), thread_id.clone());
                    Some(ProviderEvent::System { data: map })
                } else if let Some(usage) = raw.get("usage") {
                    Some(ProviderEvent::Usage {
                        input_tokens: usage.get("input_tokens").and_then(|v| v.as_u64()),
                        output_tokens: usage.get("output_tokens").and_then(|v| v.as_u64()),
                        cache_read_tokens: None,
                        cache_create_tokens: None,
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

        // Effort (reasoning effort)
        if let Some(effort) = &config.effort {
            args.push("--reasoning-effort".to_string());
            args.push(effort.clone());
        }

        // Permission mode
        if let Some(mode) = &config.permission_mode {
            args.push("--permission-mode".to_string());
            args.push(mode.clone());
        }

        // Extra args
        if let Some(extra) = &config.extra_args {
            args.extend(extra.iter().cloned());
        }

        args
    }
}

// ─── B6-1: Codex CLI 历史解析 ──────────────────────────────────────────────────

use std::fs;
use std::path::PathBuf;

/// Codex 历史会话摘要
#[derive(Debug, Clone, serde::Serialize)]
pub struct CodexHistorySession {
    pub id: String,
    pub title: Option<String>,
    pub message_count: usize,
    pub last_updated: Option<String>,
    pub cwd: Option<String>,
    pub provider: String,
}

/// 解析 Codex CLI 历史目录 (~/.codex/sessions/)
#[tauri::command]
pub async fn cc_parse_codex_history() -> Result<Vec<CodexHistorySession>, String> {
    let home = std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/tmp"));
    let codex_dir = home.join(".codex").join("sessions");
    let mut sessions = Vec::new();

    if !codex_dir.exists() {
        return Ok(sessions);
    }

    if let Ok(entries) = fs::read_dir(&codex_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() { continue; }

            let id = path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            // 统计 jsonl 文件中的消息数
            let mut message_count = 0usize;
            if let Ok(files) = fs::read_dir(&path) {
                for f in files.flatten() {
                    let fp = f.path();
                    if fp.extension().map_or(false, |ext| ext == "jsonl") {
                        if let Ok(content) = fs::read_to_string(&fp) {
                            message_count += content.lines().count();
                        }
                    }
                }
            }

            // 读取 metadata
            let mut title = None;
            let mut cwd = None;
            let metadata_path = path.join("metadata.json");
            if metadata_path.exists() {
                if let Ok(content) = fs::read_to_string(&metadata_path) {
                    if let Ok(meta) = serde_json::from_str::<serde_json::Value>(&content) {
                        title = meta.get("title")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        cwd = meta.get("cwd")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                    }
                }
            }

            // 获取最后修改时间
            let last_updated = fs::metadata(&path).ok().and_then(|m| {
                m.modified().ok().map(|t| {
                    format!("{:?}", t)
                })
            });

            sessions.push(CodexHistorySession {
                id,
                title,
                message_count,
                last_updated,
                cwd,
                provider: "codex".to_string(),
            });
        }
    }

    // 按最后更新时间排序
    sessions.sort_by(|a, b| b.last_updated.cmp(&a.last_updated));

    Ok(sessions)
}
