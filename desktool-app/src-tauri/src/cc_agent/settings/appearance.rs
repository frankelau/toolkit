// settings/appearance.rs — 外观设置（主题/字体/语言）
// Sprint V4: 新增外观持久化

use serde::{Deserialize, Serialize};
use super::{settings_path, read_json_file, write_json_file, APPEARANCE_FILE};

/// 外观设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearanceSettings {
    /// 主题：light / dark / auto
    #[serde(default = "default_theme")]
    pub theme: String,
    /// 字体大小（px）
    #[serde(default = "default_font_size")]
    pub font_size: u32,
    /// 界面语言：zh-CN / en-US
    #[serde(default = "default_locale")]
    pub locale: String,
    /// 编辑器字体
    #[serde(default)]
    pub editor_font: Option<String>,
    /// 是否启用动画
    #[serde(default = "default_enable_animations")]
    pub enable_animations: bool,
}

fn default_theme() -> String {
    "auto".to_string()
}
fn default_font_size() -> u32 {
    14
}
fn default_locale() -> String {
    "zh-CN".to_string()
}
fn default_enable_animations() -> bool {
    true
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            font_size: default_font_size(),
            locale: default_locale(),
            editor_font: None,
            enable_animations: default_enable_animations(),
        }
    }
}

/// 读取外观设置
#[tauri::command]
pub async fn cc_get_appearance() -> Result<AppearanceSettings, String> {
    let path = settings_path(APPEARANCE_FILE)?;
    let json = read_json_file(&path).await;
    if json.is_null() || json.as_object().map(|o| o.is_empty()).unwrap_or(true) {
        return Ok(AppearanceSettings::default());
    }
    serde_json::from_value(json).map_err(|e| e.to_string())
}

/// 保存外观设置
#[tauri::command]
pub async fn cc_save_appearance(
    settings: AppearanceSettings,
) -> Result<(), String> {
    let path = settings_path(APPEARANCE_FILE)?;
    let json = serde_json::to_value(&settings).map_err(|e| e.to_string())?;
    write_json_file(&path, &json).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_appearance() {
        let app = AppearanceSettings::default();
        assert_eq!(app.theme, "auto");
        assert_eq!(app.font_size, 14);
        assert_eq!(app.locale, "zh-CN");
        assert!(app.enable_animations);
    }

    #[test]
    fn test_appearance_serialize() {
        let app = AppearanceSettings::default();
        let json = serde_json::to_value(&app).unwrap();
        assert_eq!(json["theme"], "auto");
        assert_eq!(json["fontSize"], 14);
    }
}
