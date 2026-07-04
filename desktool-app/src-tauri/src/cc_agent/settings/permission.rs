// settings/permission.rs — 权限设置（读写 ~/.desktool/permission-settings.json）
// Sprint V4: 新增权限模式持久化

use super::{settings_path, read_json_file, write_json_file, PERMISSION_SETTINGS_FILE};

/// 读取权限设置
#[tauri::command]
pub async fn cc_get_permission_settings() -> Result<serde_json::Value, String> {
    let path = settings_path(PERMISSION_SETTINGS_FILE)?;
    Ok(read_json_file(&path).await)
}

/// 保存权限设置（权限模式 + 工具白名单/黑名单）
#[tauri::command]
pub async fn cc_save_permission_settings(
    settings: serde_json::Value,
) -> Result<(), String> {
    let path = settings_path(PERMISSION_SETTINGS_FILE)?;
    write_json_file(&path, &settings).await
}
