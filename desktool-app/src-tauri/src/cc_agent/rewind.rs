// rewind.rs — 会话回退/Plan审批/问答响应
// Sprint L: 从 cc_agent.rs 拆分

use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use super::types::SessionManager;

/// Phase 9: 会话回退
#[tauri::command]
pub async fn cc_rewind(
    session_id: String,
    message_id: String,
    state: tauri::State<'_, Arc<SessionManager>>,
) -> Result<serde_json::Value, String> {
    let mut sessions = state.sessions.lock().await;
    let session = sessions.get_mut(&session_id).ok_or("Session not found")?;
    let stdin = session.stdin.as_mut().ok_or("Session stdin closed")?;

    let request = serde_json::json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "method": "rewind",
        "params": { "messageId": message_id },
    });

    let line = format!("{}\n", request);
    stdin.write_all(line.as_bytes()).await.map_err(|e| e.to_string())?;
    stdin.flush().await.map_err(|e| e.to_string())?;

    // 同时截断本地历史
    let truncate_idx = session.messages.iter().position(|m| {
        m.get("message_id").and_then(|v| v.as_str()) == Some(message_id.as_str())
    });
    if let Some(idx) = truncate_idx {
        session.messages.truncate(idx + 1);
    }

    Ok(serde_json::json!({ "success": true, "messageId": message_id }))
}

/// Phase 9: Plan 审批响应
#[tauri::command]
pub async fn cc_plan_response(
    session_id: String,
    request_id: String,
    behavior: String,
    target_mode: Option<String>,
    state: tauri::State<'_, Arc<SessionManager>>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    let session = sessions.get_mut(&session_id).ok_or("Session not found")?;
    let stdin = session.stdin.as_mut().ok_or("Session stdin closed")?;

    let request = serde_json::json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "method": "plan_response",
        "params": {
            "requestId": request_id,
            "behavior": behavior,
            "targetMode": target_mode,
        },
    });

    let line = format!("{}\n", request);
    stdin.write_all(line.as_bytes()).await.map_err(|e| e.to_string())?;
    stdin.flush().await.map_err(|e| e.to_string())?;

    Ok(())
}

/// Phase 9: AskUserQuestion 响应
#[tauri::command]
pub async fn cc_ask_user_response(
    session_id: String,
    request_id: String,
    answers: serde_json::Value,
    state: tauri::State<'_, Arc<SessionManager>>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    let session = sessions.get_mut(&session_id).ok_or("Session not found")?;
    let stdin = session.stdin.as_mut().ok_or("Session stdin closed")?;

    let request = serde_json::json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "method": "ask_user_response",
        "params": {
            "requestId": request_id,
            "answers": answers,
        },
    });

    let line = format!("{}\n", request);
    stdin.write_all(line.as_bytes()).await.map_err(|e| e.to_string())?;
    stdin.flush().await.map_err(|e| e.to_string())?;

    Ok(())
}
