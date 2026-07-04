// prompt.rs — Prompt 模板管理
// Sprint L: 从 cc_agent.rs 拆分

#[allow(dead_code)]
const PROMPT_TEMPLATES_KEY: &str = "cc_prompt_templates";

/// 列出所有 prompt 模板
#[tauri::command]
pub async fn cc_list_prompt_templates() -> Result<Vec<serde_json::Value>, String> {
    let dir = dirs::home_dir()
        .map(|h| h.join(".desktool/prompts"))
        .ok_or("无法获取 home 目录")?;
    let mut templates = Vec::new();
    if let Ok(mut rd) = tokio::fs::read_dir(&dir).await {
        while let Ok(Some(entry)) = rd.next_entry().await {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("md") {
                let name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
                let content = tokio::fs::read_to_string(&path).await.unwrap_or_default();
                let modified = entry.metadata().await.ok().and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64);
                templates.push(serde_json::json!({
                    "id": name,
                    "name": name,
                    "content": content,
                    "modified": modified,
                }));
            }
        }
    }
    Ok(templates)
}

/// 保存 prompt 模板
#[tauri::command]
pub async fn cc_save_prompt_template(name: String, content: String) -> Result<(), String> {
    let dir = dirs::home_dir()
        .map(|h| h.join(".desktool/prompts"))
        .ok_or("无法获取 home 目录")?;
    tokio::fs::create_dir_all(&dir).await.map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.md", name));
    tokio::fs::write(path, content).await.map_err(|e| e.to_string())?;
    Ok(())
}

/// 删除 prompt 模板
#[tauri::command]
pub async fn cc_delete_prompt_template(name: String) -> Result<(), String> {
    let path = dirs::home_dir()
        .map(|h| h.join(format!(".desktool/prompts/{}.md", name)))
        .ok_or("无法获取 home 目录")?;
    if path.exists() {
        tokio::fs::remove_file(path).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}
