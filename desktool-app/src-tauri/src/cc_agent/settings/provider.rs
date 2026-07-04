// settings/provider.rs — Provider 设置（读写 ~/.desktool/provider-settings.json）
// Sprint V4: 新增 Provider 配置持久化

use super::{settings_path, read_json_file, write_json_file, PROVIDER_SETTINGS_FILE};

/// 读取 Provider 设置
#[tauri::command]
pub async fn cc_get_provider_settings() -> Result<serde_json::Value, String> {
    let path = settings_path(PROVIDER_SETTINGS_FILE)?;
    Ok(read_json_file(&path).await)
}

/// 保存 Provider 设置（全量覆盖）
#[tauri::command]
pub async fn cc_save_provider_settings(
    settings: serde_json::Value,
) -> Result<(), String> {
    let path = settings_path(PROVIDER_SETTINGS_FILE)?;
    write_json_file(&path, &settings).await
}

/// 列出内置 Provider 预设（对齐前端 PROVIDER_PRESETS）
#[tauri::command]
pub async fn cc_list_provider_presets() -> Result<Vec<serde_json::Value>, String> {
    Ok(vec![
        serde_json::json!({
            "id": "official",
            "label": "Claude 官方",
            "engine": "claude",
            "description": "使用 Anthropic 官方 API",
        }),
        serde_json::json!({
            "id": "custom",
            "label": "自定义 Claude",
            "engine": "claude",
            "description": "自定义 base_url 和 api_key",
        }),
        serde_json::json!({
            "id": "codex-official",
            "label": "Codex 官方",
            "engine": "codex",
            "description": "使用 OpenAI Codex",
        }),
        serde_json::json!({
            "id": "codex-custom",
            "label": "自定义 Codex",
            "engine": "codex",
            "description": "自定义 Codex 配置",
        }),
        serde_json::json!({
            "id": "disabled",
            "label": "禁用",
            "engine": "claude",
            "description": "禁用 Provider",
        }),
    ])
}

// ─── B5-4: Provider 导入/导出 + 排序 ────────────────────────────────────────────

use std::fs;

/// 导出 Provider 配置为 JSON 文件
#[tauri::command]
pub async fn cc_export_providers(
    output_path: Option<String>,
) -> Result<serde_json::Value, String> {
    let path = settings_path(PROVIDER_SETTINGS_FILE)?;
    let settings = read_json_file(&path).await;

    let out = output_path.unwrap_or_else(|| {
        let home = std::env::var("HOME")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|_| std::path::PathBuf::from("."));
        home.join("Documents").join("desktool-providers-export.json")
            .to_string_lossy()
            .to_string()
    });

    let json_str = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&out, &json_str).map_err(|e| format!("写入失败: {}", e))?;

    Ok(serde_json::json!({
        "exported": true,
        "output_path": out,
        "size": json_str.len(),
    }))
}

/// 从 JSON 文件导入 Provider 配置
#[tauri::command]
pub async fn cc_import_providers(
    input_path: String,
    strategy: Option<String>,
) -> Result<serde_json::Value, String> {
    let content = fs::read_to_string(&input_path)
        .map_err(|e| format!("读取文件失败: {}", e))?;
    let imported: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("JSON解析失败: {}", e))?;

    let merge_strategy = strategy.as_deref().unwrap_or("merge");

    if merge_strategy == "replace" {
        // 全量替换
        let path = settings_path(PROVIDER_SETTINGS_FILE)?;
        write_json_file(&path, &imported).await?;
    } else {
        // merge 策略：合并现有配置
        let path = settings_path(PROVIDER_SETTINGS_FILE)?;
        let existing = read_json_file(&path).await;

        // 简单合并：导入的覆盖现有的，现有不在导入中的保留
        let merged = if existing.is_object() && imported.is_object() {
            let mut m = existing.clone();
            if let Some(obj) = m.as_object_mut() {
                if let Some(imp_obj) = imported.as_object() {
                    for (k, v) in imp_obj {
                        obj.insert(k.clone(), v.clone());
                    }
                }
            }
            m
        } else {
            imported
        };

        write_json_file(&path, &merged).await?;
    }

    Ok(serde_json::json!({
        "imported": true,
        "strategy": merge_strategy,
        "input_path": input_path,
    }))
}

/// Provider 排序 (拖拽顺序持久化)
#[tauri::command]
pub async fn cc_reorder_providers(
    ordered_ids: Vec<String>,
) -> Result<(), String> {
    let path = settings_path(PROVIDER_SETTINGS_FILE)?;
    let mut settings = read_json_file(&path).await;

    if let Some(obj) = settings.as_object_mut() {
        obj.insert("provider_order".to_string(), serde_json::json!(ordered_ids));
    }

    write_json_file(&path, &settings).await
}
