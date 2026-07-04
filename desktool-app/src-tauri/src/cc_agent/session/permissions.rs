// session/permissions.rs — 权限相关会话命令
// Sprint V2: 从 lifecycle.rs 提取

use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use super::super::types::SessionManager;

/// 响应权限请求（转发给 bridge）
#[tauri::command]
pub async fn cc_permission_response(
    session_id: String,
    tool_use_id: String,
    behavior: String, // "allow" or "deny"
    message: Option<String>,
    state: tauri::State<'_, Arc<SessionManager>>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    let session = sessions
        .get_mut(&session_id)
        .ok_or("Session not found")?;
    let stdin = session.stdin.as_mut().ok_or("Session stdin closed")?;

    let request = serde_json::json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "method": "permission_response",
        "params": {
            "toolUseId": tool_use_id,
            "behavior": behavior,
            "message": message,
        }
    });

    let line = format!("{}\n", request);
    stdin.write_all(line.as_bytes()).await.map_err(|e| e.to_string())?;
    stdin.flush().await.map_err(|e| e.to_string())?;

    Ok(())
}

/// 切换当前会话的权限模式（运行时生效，不写文件）
#[tauri::command]
pub async fn cc_set_permission_mode(
    session_id: String,
    mode: String,
    state: tauri::State<'_, Arc<SessionManager>>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    let session = sessions
        .get_mut(&session_id)
        .ok_or("Session not found")?;
    if let Some(stdin) = session.stdin.as_mut() {
        let request = serde_json::json!({
            "id": uuid::Uuid::new_v4().to_string(),
            "method": "set_permission_mode",
            "params": { "mode": mode },
        });
        let line = format!("{}\n", request);
        let _ = stdin.write_all(line.as_bytes()).await;
        let _ = stdin.flush().await;
    }
    Ok(())
}
