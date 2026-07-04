// codex.rs — Codex 消息格式转换
// Sprint L: 从 cc_agent.rs 拆分

/// 把 Claude 消息格式转成 Codex/OpenAI 格式
#[tauri::command]
pub async fn cc_convert_to_codex_format(
    messages: Vec<serde_json::Value>,
) -> Result<Vec<serde_json::Value>, String> {
    let mut converted = Vec::new();
    for msg in messages {
        let role = msg.get("role").and_then(|r| r.as_str()).unwrap_or("user");
        let content = msg.get("content").and_then(|c| c.as_str()).unwrap_or("");
        let codex_role = match role {
            "user" => "user",
            "assistant" => "assistant",
            "system" => "system",
            _ => "user",
        };
        converted.push(serde_json::json!({
            "role": codex_role,
            "content": content,
        }));
    }
    Ok(converted)
}

/// 把 Codex/OpenAI 消息格式转回 Claude 格式
#[tauri::command]
pub async fn cc_convert_from_codex_format(
    messages: Vec<serde_json::Value>,
) -> Result<Vec<serde_json::Value>, String> {
    let mut converted = Vec::new();
    for msg in messages {
        let role = msg.get("role").and_then(|r| r.as_str()).unwrap_or("user");
        let content = msg.get("content").and_then(|c| c.as_str()).unwrap_or("");
        converted.push(serde_json::json!({
            "role": role,
            "content": content,
        }));
    }
    Ok(converted)
}
