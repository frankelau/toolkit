// session/context.rs — 上下文与消息相关会话命令
// Sprint V2: 从 lifecycle.rs 提取

use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use super::super::types::{Engine, SessionManager, Attachment};

/// 发送消息到活跃会话
#[tauri::command]
pub async fn cc_send_message(
    session_id: String,
    message: String,
    attachments: Option<Vec<Attachment>>,
    state: tauri::State<'_, Arc<SessionManager>>,
) -> Result<(), String> {
    eprintln!("[cc-bridge] cc_send_message session={} msg_len={}", session_id, message.len());
    let mut sessions = state.sessions.lock().await;
    let session = sessions
        .get_mut(&session_id)
        .ok_or("Session not found")?;
    let stdin = session.stdin.as_mut().ok_or("Session stdin closed")?;

    let engine_str = match session.engine {
        Engine::Claude => "claude",
        Engine::Codex => "codex",
    };

    let request = serde_json::json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "method": "send",
        "params": {
            "engine": engine_str,
            "message": message,
            "attachments": attachments,
            "cwd": session.cwd,
            "sessionId": session.claude_session_id,
            "threadId": session.codex_thread_id,
            "baseUrl": session.base_url,
            "apiKey": session.api_key,
            "thinking": session.thinking,
            "includePartialMessages": session.include_partial_messages,
        }
    });

    let line = format!("{}\n", request);
    stdin
        .write_all(line.as_bytes())
        .await
        .map_err(|e| e.to_string())?;
    stdin.flush().await.map_err(|e| e.to_string())?;

    Ok(())
}

/// 获取会话历史消息
#[tauri::command]
pub async fn cc_get_history(
    session_id: String,
    state: tauri::State<'_, Arc<SessionManager>>,
) -> Result<Vec<serde_json::Value>, String> {
    let sessions = state.sessions.lock().await;
    let session = sessions
        .get(&session_id)
        .ok_or("Session not found")?;
    Ok(session.messages.clone())
}

/// 获取上下文用量（请求 bridge）
#[tauri::command]
pub async fn cc_get_context_usage(
    session_id: String,
    state: tauri::State<'_, Arc<SessionManager>>,
) -> Result<serde_json::Value, String> {
    let mut sessions = state.sessions.lock().await;
    let session = sessions
        .get_mut(&session_id)
        .ok_or("Session not found")?;
    let stdin = session.stdin.as_mut().ok_or("Session stdin closed")?;

    let request = serde_json::json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "method": "get_context_usage",
        "params": {},
    });

    let line = format!("{}\n", request);
    stdin
        .write_all(line.as_bytes())
        .await
        .map_err(|e| e.to_string())?;
    stdin.flush().await.map_err(|e| e.to_string())?;

    Ok(serde_json::json!({"status": "requested"}))
}

/// 提示词增强（转发给 bridge）
#[tauri::command]
pub async fn cc_enhance_prompt(
    session_id: Option<String>,
    prompt: String,
    engine: Option<String>,
    state: tauri::State<'_, Arc<SessionManager>>,
) -> Result<String, String> {
    if let Some(sid) = &session_id {
        let mut sessions = state.sessions.lock().await;
        if let Some(session) = sessions.get_mut(sid) {
            if let Some(stdin) = session.stdin.as_mut() {
                let request = serde_json::json!({
                    "id": uuid::Uuid::new_v4().to_string(),
                    "method": "enhance_prompt",
                    "params": {
                        "prompt": prompt,
                        "engine": engine.unwrap_or_else(|| "claude".to_string()),
                    },
                });
                let line = format!("{}\n", request);
                stdin
                    .write_all(line.as_bytes())
                    .await
                    .map_err(|e| e.to_string())?;
                stdin.flush().await.map_err(|e| e.to_string())?;
                return Err("bridge async".to_string()); // 触发前端 fallback
            }
        }
    }
    Err("no active session".to_string())
}
