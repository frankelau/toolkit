// usage.rs — 使用统计 + 输入历史
// Sprint L: 从 cc_agent.rs 拆分

const USAGE_FILE: &str = ".desktool/usage.json";
const INPUT_HISTORY_FILE: &str = ".desktool/input_history.json";

/// 读取累计使用统计
#[tauri::command]
pub async fn cc_get_usage_stats() -> Result<serde_json::Value, String> {
    let path = dirs::home_dir()
        .map(|h| h.join(USAGE_FILE))
        .ok_or("无法获取 home 目录")?;
    let content = tokio::fs::read_to_string(&path).await.unwrap_or_else(|_| "{\"totalCost\":0,\"totalInput\":0,\"totalOutput\":0,\"sessions\":[]}".to_string());
    let v: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(v)
}

/// 追加一次会话的使用记录
#[tauri::command]
pub async fn cc_push_usage_record(
    session_id: String,
    model: String,
    input_tokens: u64,
    output_tokens: u64,
    cost_usd: f64,
    message_count: u64,
    summary: Option<String>,
) -> Result<(), String> {
    let path = dirs::home_dir()
        .map(|h| h.join(USAGE_FILE))
        .ok_or("无法获取 home 目录")?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }
    let content = tokio::fs::read_to_string(&path).await.unwrap_or_else(|_| "{\"totalCost\":0,\"totalInput\":0,\"totalOutput\":0,\"sessions\":[]}".to_string());
    let mut v: serde_json::Value = serde_json::from_str(&content).unwrap_or(serde_json::json!({"totalCost":0,"totalInput":0,"totalOutput":0,"sessions":[]}));
    let cur_cost = v.get("totalCost").and_then(|c| c.as_f64()).unwrap_or(0.0) + cost_usd;
    let cur_in = v.get("totalInput").and_then(|c| c.as_u64()).unwrap_or(0) + input_tokens;
    let cur_out = v.get("totalOutput").and_then(|c| c.as_u64()).unwrap_or(0) + output_tokens;
    v["totalCost"] = serde_json::json!(cur_cost);
    v["totalInput"] = serde_json::json!(cur_in);
    v["totalOutput"] = serde_json::json!(cur_out);
    if v.get("sessions").is_none() {
        v["sessions"] = serde_json::json!([]);
    }
    let record = serde_json::json!({
        "sessionId": session_id,
        "model": model,
        "inputTokens": input_tokens,
        "outputTokens": output_tokens,
        "costUsd": cost_usd,
        "messageCount": message_count,
        "summary": summary.unwrap_or_default(),
        "ts": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0),
    });
    if let Some(arr) = v.get_mut("sessions").and_then(|s| s.as_array_mut()) {
        arr.push(record);
        if arr.len() > 1000 {
            let drain = arr.len() - 1000;
            arr.drain(..drain);
        }
    }
    let json = serde_json::to_string_pretty(&v).map_err(|e| e.to_string())?;
    tokio::fs::write(path, json).await.map_err(|e| e.to_string())?;
    Ok(())
}

/// 重置使用统计
#[tauri::command]
pub async fn cc_reset_usage_stats() -> Result<(), String> {
    let path = dirs::home_dir()
        .map(|h| h.join(USAGE_FILE))
        .ok_or("无法获取 home 目录")?;
    tokio::fs::write(path, "{\"totalCost\":0,\"totalInput\":0,\"totalOutput\":0,\"sessions\":[]}")
        .await.map_err(|e| e.to_string())?;
    Ok(())
}

/// 读取输入历史
#[tauri::command]
pub async fn cc_get_input_history(cwd: Option<String>) -> Result<Vec<String>, String> {
    let path = dirs::home_dir()
        .map(|h| h.join(INPUT_HISTORY_FILE))
        .ok_or("无法获取 home 目录")?;
    let content = tokio::fs::read_to_string(&path).await.unwrap_or_else(|_| "{\"items\":[]}".to_string());
    let v: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let items = v.get("items").and_then(|i| i.as_array()).cloned().unwrap_or_default();
    let filtered: Vec<String> = items.iter()
        .filter_map(|i| {
            let text = i.get("text").and_then(|t| t.as_str())?.to_string();
            if let Some(ref c) = cwd {
                let item_cwd = i.get("cwd").and_then(|c| c.as_str()).unwrap_or("");
                if !c.is_empty() && item_cwd != c { return None; }
            }
            Some(text)
        })
        .collect();
    Ok(filtered)
}

/// 追加输入历史
#[tauri::command]
pub async fn cc_add_input_history(text: String, cwd: Option<String>) -> Result<(), String> {
    let path = dirs::home_dir()
        .map(|h| h.join(INPUT_HISTORY_FILE))
        .ok_or("无法获取 home 目录")?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }
    let content = tokio::fs::read_to_string(&path).await.unwrap_or_else(|_| "{\"items\":[]}".to_string());
    let mut v: serde_json::Value = serde_json::from_str(&content).unwrap_or(serde_json::json!({"items":[]}));
    if v.get("items").is_none() {
        v["items"] = serde_json::json!([]);
    }
    let entry = serde_json::json!({
        "text": text,
        "cwd": cwd,
        "ts": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0),
    });
    if let Some(arr) = v.get_mut("items").and_then(|i| i.as_array_mut()) {
        arr.push(entry);
        if arr.len() > 500 {
            let drain = arr.len() - 500;
            arr.drain(..drain);
        }
    }
    let json = serde_json::to_string_pretty(&v).map_err(|e| e.to_string())?;
    tokio::fs::write(path, json).await.map_err(|e| e.to_string())?;
    Ok(())
}

/// 清空输入历史
#[tauri::command]
pub async fn cc_clear_input_history() -> Result<(), String> {
    let path = dirs::home_dir()
        .map(|h| h.join(INPUT_HISTORY_FILE))
        .ok_or("无法获取 home 目录")?;
    tokio::fs::write(path, "{\"items\":[]}").await.map_err(|e| e.to_string())?;
    Ok(())
}
