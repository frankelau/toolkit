// settings/project.rs — 项目配置（CLAUDE.md + .claude/settings.json）
// Sprint V4: 从 global.rs 拆分

/// 读取项目配置（CLAUDE.md + .claude/settings.json + settings.local.json）
#[tauri::command]
pub async fn cc_get_project_config(cwd: String) -> Result<serde_json::Value, String> {
    let claude_md = tokio::fs::read_to_string(format!("{}/CLAUDE.md", cwd))
        .await
        .unwrap_or_default();

    let settings_path = format!("{}/.claude/settings.json", cwd);
    let settings = tokio::fs::read_to_string(&settings_path)
        .await
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .unwrap_or(serde_json::json!({}));

    let local_settings_path = format!("{}/.claude/settings.local.json", cwd);
    let local_settings = tokio::fs::read_to_string(&local_settings_path)
        .await
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .unwrap_or(serde_json::json!({}));

    Ok(serde_json::json!({
        "claudeMd": claude_md,
        "settings": settings,
        "localSettings": local_settings,
        "cwd": cwd,
    }))
}

/// 保存项目配置
#[tauri::command]
pub async fn cc_save_project_config(
    cwd: String,
    claude_md: Option<String>,
    settings: Option<serde_json::Value>,
) -> Result<(), String> {
    if let Some(md) = claude_md {
        tokio::fs::write(format!("{}/CLAUDE.md", cwd), md)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(s) = settings {
        let dir = format!("{}/.claude", cwd);
        tokio::fs::create_dir_all(&dir)
            .await
            .map_err(|e| e.to_string())?;
        let json = serde_json::to_string_pretty(&s).map_err(|e| e.to_string())?;
        tokio::fs::write(format!("{}/settings.json", dir), json)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
