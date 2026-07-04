// settings/mod.rs — 设置模块入口
// Sprint V4: 从 settings.rs 85 行深化为 6 文件目录
// 对齐 cc-gui settings 包结构

pub mod global;
pub mod project;
pub mod provider;
pub mod permission;
pub mod appearance;

pub mod notification;

// 再导出所有 Tauri 命令（保持 cc_agent.rs 的 pub use 不变）
pub use global::{cc_get_settings, cc_save_settings};
pub use project::{cc_get_project_config, cc_save_project_config};
pub use provider::{cc_get_provider_settings, cc_save_provider_settings, cc_list_provider_presets};
pub use permission::{cc_get_permission_settings, cc_save_permission_settings};
pub use appearance::{cc_get_appearance, cc_save_appearance, AppearanceSettings};
pub use notification::{cc_get_notification_settings, cc_save_notification_settings};

// 共享常量
pub const SETTINGS_FILE: &str = ".desktool/settings.json";
pub const PROVIDER_SETTINGS_FILE: &str = ".desktool/provider-settings.json";
pub const PERMISSION_SETTINGS_FILE: &str = ".desktool/permission-settings.json";
pub const APPEARANCE_FILE: &str = ".desktool/appearance.json";

/// 获取设置文件路径
pub fn settings_path(file: &str) -> Result<std::path::PathBuf, String> {
    let home = dirs::home_dir().ok_or("无法获取 home 目录")?;
    Ok(home.join(file))
}

/// 读取 JSON 文件（不存在返回空对象）
pub async fn read_json_file(path: &std::path::Path) -> serde_json::Value {
    let content = tokio::fs::read_to_string(path)
        .await
        .unwrap_or_else(|_| "{}".to_string());
    serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
}

/// 写入 JSON 文件（确保目录存在）
pub async fn write_json_file(
    path: &std::path::Path,
    value: &serde_json::Value,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    tokio::fs::write(path, json)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 合并 JSON 对象（other 覆盖 base）
pub fn merge_json(base: &serde_json::Value, other: &serde_json::Value) -> serde_json::Value {
    match (base, other) {
        (serde_json::Value::Object(b), serde_json::Value::Object(o)) => {
            let mut result = b.clone();
            for (k, v) in o {
                result.insert(k.clone(), v.clone());
            }
            serde_json::Value::Object(result)
        }
        (_, o) => o.clone(),
    }
}
