// provider/mcp.rs — MCP 服务器管理
// Sprint L: 从 cc_agent.rs 拆分（原 provider.rs 内容）
// Sprint S1: 迁移到 provider/ 目录

use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use crate::cc_agent::types::SessionManager;

/// 列出所有 MCP 服务器配置（从 ~/.claude.json 读取）
#[tauri::command]
pub async fn cc_list_mcp_servers() -> Result<serde_json::Value, String> {
    let path = dirs::home_dir()
        .map(|h| h.join(".claude.json"))
        .ok_or("无法获取 home 目录")?;
    let content = tokio::fs::read_to_string(&path).await.map_err(|e| e.to_string())?;
    let v: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let servers = v.get("mcpServers").cloned().unwrap_or(serde_json::json!({}));
    Ok(servers)
}

/// 添加 MCP 服务器
#[tauri::command]
pub async fn cc_add_mcp_server(name: String, config: serde_json::Value) -> Result<(), String> {
    let path = dirs::home_dir()
        .map(|h| h.join(".claude.json"))
        .ok_or("无法获取 home 目录")?;
    let content = tokio::fs::read_to_string(&path).await.unwrap_or_else(|_| "{}".to_string());
    let mut v: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    if v.get("mcpServers").is_none() {
        v["mcpServers"] = serde_json::json!({});
    }
    v["mcpServers"][&name] = config;
    let json = serde_json::to_string_pretty(&v).map_err(|e| e.to_string())?;
    tokio::fs::write(path, json).await.map_err(|e| e.to_string())?;
    Ok(())
}

/// 移除 MCP 服务器
#[tauri::command]
pub async fn cc_remove_mcp_server(name: String) -> Result<(), String> {
    let path = dirs::home_dir()
        .map(|h| h.join(".claude.json"))
        .ok_or("无法获取 home 目录")?;
    let content = tokio::fs::read_to_string(&path).await.unwrap_or_else(|_| "{}".to_string());
    let mut v: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    if let Some(servers) = v.get_mut("mcpServers").and_then(|s| s.as_object_mut()) {
        servers.remove(&name);
    }
    let json = serde_json::to_string_pretty(&v).map_err(|e| e.to_string())?;
    tokio::fs::write(path, json).await.map_err(|e| e.to_string())?;
    Ok(())
}

/// 获取 MCP 服务器工具列表（通过 bridge 调用）
#[tauri::command]
pub async fn cc_get_mcp_tools(
    server_name: String,
    state: tauri::State<'_, Arc<SessionManager>>,
) -> Result<serde_json::Value, String> {
    let sid_and_line = {
        let sessions = state.sessions.lock().await;
        for (sid, session) in sessions.iter() {
            if let Some(stdin) = session.stdin.as_ref() {
                let request = serde_json::json!({
                    "id": uuid::Uuid::new_v4().to_string(),
                    "method": "list_mcp_tools",
                    "params": { "serverName": server_name },
                });
                let line = format!("{}\n", request);
                Some((sid.clone(), line))
            } else {
                None
            };
        }
        None::<(String, String)>
    };

    if let Some((sid, line)) = sid_and_line {
        let mut sessions = state.sessions.lock().await;
        if let Some(session) = sessions.get_mut(&sid) {
            if let Some(stdin) = session.stdin.as_mut() {
                let _ = stdin.write_all(line.as_bytes()).await;
                let _ = stdin.flush().await;
            }
        }
        return Ok(serde_json::json!({ "status": "requested", "serverName": server_name }));
    }
    Ok(serde_json::json!({ "tools": [] }))
}
