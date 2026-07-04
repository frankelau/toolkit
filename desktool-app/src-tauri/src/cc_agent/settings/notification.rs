// settings/notification.rs — 通知设置
// Sprint Y2: 通知偏好配置

use super::{settings_path, read_json_file, write_json_file};

const NOTIFICATION_SETTINGS_FILE: &str = "notification-settings.json";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct NotificationSettings {
    pub sound_enabled: bool,
    pub system_notifications: bool,
    pub completion_notify: bool,
    pub error_notify: bool,
    pub permission_notify: bool,
    pub volume: f64,
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            sound_enabled: true,
            system_notifications: true,
            completion_notify: true,
            error_notify: true,
            permission_notify: true,
            volume: 0.7,
        }
    }
}

#[tauri::command]
pub async fn cc_get_notification_settings() -> Result<NotificationSettings, String> {
    let path = settings_path(NOTIFICATION_SETTINGS_FILE)?;
    let json = read_json_file(&path).await;
    Ok(serde_json::from_value(json).unwrap_or_default())
}

#[tauri::command]
pub async fn cc_save_notification_settings(
    settings: NotificationSettings,
) -> Result<(), String> {
    let path = settings_path(NOTIFICATION_SETTINGS_FILE)?;
    write_json_file(&path, &serde_json::to_value(&settings).unwrap_or_default()).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_settings() {
        let default = NotificationSettings::default();
        assert!(default.sound_enabled);
        assert_eq!(default.volume, 0.7);
    }
}
