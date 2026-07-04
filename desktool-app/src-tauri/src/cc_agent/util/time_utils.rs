// util/time_utils.rs — 时间/日期工具

use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// 获取当前时间戳（毫秒）
pub fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

/// 获取当前时间戳（秒）
pub fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// 格式化持续时间
pub fn format_duration(duration: Duration) -> String {
    let total_secs = duration.as_secs();
    if total_secs < 60 {
        format!("{}s", total_secs)
    } else if total_secs < 3600 {
        format!("{}m {}s", total_secs / 60, total_secs % 60)
    } else {
        let hours = total_secs / 3600;
        let mins = (total_secs % 3600) / 60;
        format!("{}h {}m", hours, mins)
    }
}

/// 格式化持续时间（简短格式）
pub fn format_duration_short(duration: Duration) -> String {
    let total_secs = duration.as_secs();
    if total_secs < 60 {
        format!("{}s", total_secs)
    } else if total_secs < 3600 {
        format!("{}m", total_secs / 60)
    } else {
        format!("{}h", total_secs / 3600)
    }
}

/// 格式化相对时间（如 "3m ago", "2h ago", "1d ago"）
pub fn format_relative(past_millis: u128) -> String {
    let now = now_millis();
    let diff = now.saturating_sub(past_millis);

    if diff < 60_000 {
        "just now".to_string()
    } else if diff < 3_600_000 {
        format!("{}m ago", diff / 60_000)
    } else if diff < 86_400_000 {
        format!("{}h ago", diff / 3_600_000)
    } else {
        format!("{}d ago", diff / 86_400_000)
    }
}

/// 格式化 ISO 8601 时间字符串
pub fn iso_now() -> String {
    let now = SystemTime::now();
    let since_epoch = now.duration_since(UNIX_EPOCH).unwrap_or_default();
    let secs = since_epoch.as_secs();
    // 简化版 ISO 8601
    let days = secs / 86400 + 719468;
    // (A very simplified version - for real use, use the `time` crate)
    format!("unix+{}s", secs)
}

/// 判断是否超时
pub fn is_expired(timestamp_millis: u128, ttl_millis: u64) -> bool {
    now_millis() > timestamp_millis + ttl_millis as u128
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_duration() {
        assert!(format_duration(Duration::from_secs(30)).contains('s'));
        assert!(format_duration(Duration::from_secs(90)).contains('m'));
        assert!(format_duration(Duration::from_secs(3700)).contains('h'));
    }

    #[test]
    fn test_format_relative() {
        let recent = now_millis() - 30_000; // 30 seconds ago
        assert_eq!(format_relative(recent), "just now");

        let minute_ago = now_millis() - 120_000; // 2 minutes ago
        assert!(format_relative(minute_ago).contains("m ago"));
    }

    #[test]
    fn test_is_expired() {
        let past = now_millis() - 10000;
        assert!(is_expired(past, 5000));
        assert!(!is_expired(past, 20000));
    }
}
