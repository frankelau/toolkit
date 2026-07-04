// settings/global.rs — 全局设置（读写 ~/.desktool/settings.json）
// Sprint V4: 只保留全局设置，项目配置移至 project.rs

use super::{settings_path, read_json_file, write_json_file, merge_json, SETTINGS_FILE};

/// 读取全局设置
#[tauri::command]
pub async fn cc_get_settings() -> Result<serde_json::Value, String> {
    let path = settings_path(SETTINGS_FILE)?;
    Ok(read_json_file(&path).await)
}

/// 保存全局设置（merge 模式）
#[tauri::command]
pub async fn cc_save_settings(settings: serde_json::Value) -> Result<(), String> {
    let path = settings_path(SETTINGS_FILE)?;
    let existing = read_json_file(&path).await;
    let merged = merge_json(&existing, &settings);
    write_json_file(&path, &merged).await
}
