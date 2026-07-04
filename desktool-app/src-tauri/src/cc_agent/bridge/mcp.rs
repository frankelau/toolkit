// bridge/mcp.rs — MCP 服务器通过 bridge 管理
// Sprint V3: MCP 桥接命令

use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use super::super::types::SessionManager;

/// 通过 bridge 列出 MCP 服务器
pub async fn bridge_list_mcp_servers(
    stdin: &mut tokio::process::ChildStdin,
) -> Result<String, String> {
    let request = serde_json::json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "method": "list_mcp_servers",
        "params": {},
    });
    let line = format!("{}\n", request);
    stdin
        .write_all(line.as_bytes())
        .await
        .map_err(|e| e.to_string())?;
    stdin.flush().await.map_err(|e| e.to_string())?;
    Ok("requested".to_string())
}

/// 通过 bridge 添加 MCP 服务器
pub async fn bridge_add_mcp_server(
    stdin: &mut tokio::process::ChildStdin,
    name: &str,
    command: &str,
    args: &[String],
    env: Option<&serde_json::Value>,
) -> Result<String, String> {
    let request = serde_json::json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "method": "add_mcp_server",
        "params": {
            "name": name,
            "command": command,
            "args": args,
            "env": env,
        }
    });
    let line = format!("{}\n", request);
    stdin
        .write_all(line.as_bytes())
        .await
        .map_err(|e| e.to_string())?;
    stdin.flush().await.map_err(|e| e.to_string())?;
    Ok("requested".to_string())
}

/// 通过 bridge 移除 MCP 服务器
pub async fn bridge_remove_mcp_server(
    stdin: &mut tokio::process::ChildStdin,
    name: &str,
) -> Result<String, String> {
    let request = serde_json::json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "method": "remove_mcp_server",
        "params": { "name": name },
    });
    let line = format!("{}\n", request);
    stdin
        .write_all(line.as_bytes())
        .await
        .map_err(|e| e.to_string())?;
    stdin.flush().await.map_err(|e| e.to_string())?;
    Ok("requested".to_string())
}

/// 通过活跃会话的 stdin 发送 MCP 命令
pub async fn send_mcp_command(
    session_id: &str,
    method: &str,
    params: serde_json::Value,
    state: &Arc<SessionManager>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    let session = sessions
        .get_mut(session_id)
        .ok_or("Session not found")?;
    let stdin = session.stdin.as_mut().ok_or("Session stdin closed")?;

    let request = serde_json::json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "method": method,
        "params": params,
    });
    let line = format!("{}\n", request);
    stdin
        .write_all(line.as_bytes())
        .await
        .map_err(|e| e.to_string())?;
    stdin.flush().await.map_err(|e| e.to_string())?;
    Ok(())
}
