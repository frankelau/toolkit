// session/streaming.rs — 流式事件解析 + 限流 + 合并
// Sprint B: 对齐 cc-gui StreamDeltaThrottler + StreamMessageCoalescer
//
// cc-gui 架构:
//   StreamDeltaThrottler: 50ms 间隔批量推送 delta 文本，避免 UI 过载
//   StreamMessageCoalescer: 合并连续同类型消息，去重，批量注入
//
// ccagent 适配:
//   Throttler: 用 tokio::time 批量推送 content_block_delta
//   Coalescer: 在 emit 前合并连续 assistant text + tool_use

use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::mpsc;
use tokio::time::interval;
use tauri::{AppHandle, Emitter};

use super::super::types::SessionManager;

// ─── Stream Delta Throttler ─────────────────────────────────────────────────
// 对齐 cc-gui StreamDeltaThrottler: 50ms 批量间隔，delta 文本合并发送

const THROTTLE_INTERVAL_MS: u64 = 50;

/// 限流器内部消息
enum ThrottleMsg {
    Delta { text: String },
    Full { json_val: serde_json::Value },
    Flush,
    Shutdown,
}

/// 限流器：批量推送 delta 文本
struct DeltaThrottler {
    pending: Vec<String>,
    tx: mpsc::Sender<ThrottleMsg>,
}

impl DeltaThrottler {
    fn new(app: AppHandle, event_base: String) -> Self {
        let (tx, mut rx) = mpsc::channel::<ThrottleMsg>(256);
        let app_c = app.clone();
        let event_c = event_base.clone();

        tokio::spawn(async move {
            let mut tick = interval(Duration::from_millis(THROTTLE_INTERVAL_MS));
            let mut pending_text: Vec<String> = Vec::new();
            let mut running = true;

            while running {
                tokio::select! {
                    _ = tick.tick() => {
                        if !pending_text.is_empty() {
                            let combined = pending_text.join("");
                            pending_text.clear();
                            let _ = app_c.emit(&event_c, serde_json::json!({
                                "type": "content_block_delta",
                                "data": {"text": combined}
                            }));
                        }
                    }
                    msg = rx.recv() => {
                        match msg {
                            Some(ThrottleMsg::Delta { text }) => {
                                pending_text.push(text);
                            }
                            Some(ThrottleMsg::Full { json_val }) => {
                                // Flush pending before full message
                                if !pending_text.is_empty() {
                                    let combined = pending_text.join("");
                                    pending_text.clear();
                                    let _ = app_c.emit(&event_c, serde_json::json!({
                                        "type": "content_block_delta",
                                        "data": {"text": combined}
                                    }));
                                }
                                let t = json_val.get("type").and_then(|v| v.as_str()).unwrap_or("?");
                                match app_c.emit(&event_c, &json_val) {
                                    Ok(()) => eprintln!("[cc-bridge] EMIT OK type={} to {}", t, &event_c),
                                    Err(e) => eprintln!("[cc-bridge] EMIT FAIL type={}: {}", t, e),
                                }
                            }
                            Some(ThrottleMsg::Flush) => {
                                if !pending_text.is_empty() {
                                    let combined = pending_text.join("");
                                    pending_text.clear();
                                    let _ = app_c.emit(&event_c, serde_json::json!({
                                        "type": "content_block_delta",
                                        "data": {"text": combined}
                                    }));
                                }
                            }
                            Some(ThrottleMsg::Shutdown) | None => {
                                // Final flush before shutdown
                                if !pending_text.is_empty() {
                                    let combined = pending_text.join("");
                                    let _ = app_c.emit(&event_c, serde_json::json!({
                                        "type": "content_block_delta",
                                        "data": {"text": combined}
                                    }));
                                }
                                running = false;
                            }
                        }
                    }
                }
            }
        });

        Self { pending: Vec::new(), tx }
    }

    fn push_delta(&mut self, text: String) {
        let _ = self.tx.try_send(ThrottleMsg::Delta { text });
    }

    fn emit_full(&self, json_val: serde_json::Value) {
        let _ = self.tx.try_send(ThrottleMsg::Full { json_val });
    }

    fn flush(&self) {
        let _ = self.tx.try_send(ThrottleMsg::Flush);
    }

    fn shutdown(self) {
        let _ = self.tx.try_send(ThrottleMsg::Shutdown);
    }
}

// ─── Extraction ─────────────────────────────────────────────────────────────

/// 从 stream 事件中提取 Claude session_id
pub fn extract_session_id(data: &serde_json::Value) -> Option<String> {
    if data.get("type").and_then(|v| v.as_str()) == Some("system") {
        data.get("session_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    } else {
        None
    }
}

/// 从 result 事件中提取 Codex threadId
pub fn extract_thread_id(json_val: &serde_json::Value) -> Option<String> {
    if json_val.get("type").and_then(|v| v.as_str()) == Some("result") {
        json_val
            .get("threadId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    } else {
        None
    }
}

/// 处理一行 stdout 输出，返回 (msg_type, json_val)
pub fn process_stream_line(line: &str) -> Option<(String, serde_json::Value)> {
    if line.trim().is_empty() {
        return None;
    }
    if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(line) {
        let msg_type = json_val
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        Some((msg_type, json_val))
    } else {
        None
    }
}

/// 判断是否为 delta 类型（可被限流合并）
fn is_delta_event(msg_type: &str) -> bool {
    matches!(
        msg_type,
        "content_block_delta" | "assistant_stream" | "text_delta"
    )
}

// ─── Spawners ───────────────────────────────────────────────────────────────

/// 启动 stderr 读取任务（转发到前端）
pub fn spawn_stderr_reader(
    stderr: tokio::process::ChildStderr,
    app: AppHandle,
    event_base: String,
) {
    tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            eprintln!("[cc-bridge] stderr: {}", line);
            let _ = app.emit(
                &event_base,
                serde_json::json!({"type": "stderr", "text": line}),
            );
        }
    });
}

/// 启动 stdout 读取任务（解析事件 + 限流 + 合并 + 转发到前端）
pub fn spawn_stdout_reader(
    stdout: tokio::process::ChildStdout,
    app: AppHandle,
    event_base: String,
    session_id: String,
    state: Arc<SessionManager>,
) {
    let app_clone = app.clone();
    let app_emit = app.clone();
    let event_base_emit = event_base.clone();

    tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        eprintln!("[cc-bridge] spawn_stdout_reader started for session={}", session_id);

        // 初始化限流器（delta 文本批量推送）
        let mut throttler = DeltaThrottler::new(app_clone.clone(), event_base.clone());

        let mut line_count = 0u64;
        while let Ok(Some(line)) = lines.next_line().await {
            line_count += 1;
            // Log first 5 lines + every 10th after, plus always log "result" and "error" types
            if line_count <= 5 || line_count % 10 == 0
                || line.contains("\"type\":\"result\"")
                || line.contains("\"type\":\"error\"")
            {
                eprintln!("[cc-bridge] stdout line#{} ({} chars): {}", line_count, line.len(), &line[..std::cmp::min(line.len(), 250)]);
            }
            if let Some((msg_type, json_val)) = process_stream_line(&line) {
                // 提取 session_id
                if msg_type == "stream" {
                    if let Some(data) = json_val.get("data") {
                        if let Some(sid) = extract_session_id(data) {
                            let mut sessions = state.sessions.lock().await;
                            if let Some(session) = sessions.get_mut(&session_id) {
                                session.claude_session_id = Some(sid);
                            }
                        }
                        // 存入历史
                        {
                            let mut sessions = state.sessions.lock().await;
                            if let Some(session) = sessions.get_mut(&session_id) {
                                session.messages.push(data.clone());
                            }
                        }
                    }
                }

                // 提取 Codex threadId
                if let Some(thread_id) = extract_thread_id(&json_val) {
                    let mut sessions = state.sessions.lock().await;
                    if let Some(session) = sessions.get_mut(&session_id) {
                        session.codex_thread_id = Some(thread_id);
                    }
                }

                // Throttle delta events; pass everything else straight through.
                // NOTE: non-delta events (system / assistant / user / result) MUST
                // be forwarded immediately and in order — coalescing/holding them
                // in a buffer caused `result` to never reach the frontend, so the
                // assistant bubble stayed in the streaming (typing dots) state.
                if is_delta_event(&msg_type) {
                    if let Some(text) = json_val
                        .get("data")
                        .and_then(|d| d.get("text"))
                        .and_then(|t| t.as_str())
                    {
                        throttler.push_delta(text.to_string());
                    } else {
                        throttler.emit_full(json_val);
                    }
                } else {
                    // Flush any pending delta text before the structural event so
                    // ordering is preserved, then emit the event as-is.
                    throttler.emit_full(json_val);
                }
            } else {
                let raw = serde_json::json!({"type": "raw", "text": line});
                let _ = app_emit.emit(&event_base_emit, &raw);
            }
        }

        // 流结束：flush throttle
        throttler.flush();
        throttler.shutdown();

        let _ = app_emit.emit(
            &event_base_emit,
            serde_json::json!({"type": "stream_end"}),
        );

        // 清理会话
        let mut sessions = state.sessions.lock().await;
        sessions.remove(&session_id);
    });
}
