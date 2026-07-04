// util/size.rs — 文件大小格式化工具

/// 格式化字节数为可读字符串
pub fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_idx = 0;

    while size >= 1024.0 && unit_idx < UNITS.len() - 1 {
        size /= 1024.0;
        unit_idx += 1;
    }

    if unit_idx == 0 {
        format!("{} {}", size as u64, UNITS[unit_idx])
    } else {
        format!("{:.1} {}", size, UNITS[unit_idx])
    }
}

/// 格式化字节数（始终显示一位小数）
pub fn format_bytes_precise(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB", "PB"];
    let mut size = bytes as f64;
    let mut unit_idx = 0;

    while size >= 1024.0 && unit_idx < UNITS.len() - 1 {
        size /= 1024.0;
        unit_idx += 1;
    }

    format!("{:.2} {}", size, UNITS[unit_idx])
}

/// 解析字节字符串（如 "1.5 MB" → 1572864）
pub fn parse_bytes(input: &str) -> Option<u64> {
    let input = input.trim().to_lowercase();
    let multipliers: Vec<(&str, u64)> = vec![
        ("tb", 1_099_511_627_776),
        ("gb", 1_073_741_824),
        ("mb", 1_048_576),
        ("kb", 1_024),
        ("b", 1),
    ];

    for (suffix, multiplier) in multipliers {
        if let Some(num_str) = input.strip_suffix(suffix) {
            let num: f64 = num_str.trim().parse().ok()?;
            return Some((num * multiplier as f64) as u64);
        }
    }

    input.parse::<u64>().ok()
}

/// 判断大小是否超过限制
pub fn exceeds(bytes: u64, limit: &str) -> bool {
    parse_bytes(limit).map(|l| bytes > l).unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_bytes() {
        assert_eq!(format_bytes(0), "0 B");
        assert_eq!(format_bytes(500), "500 B");
        assert_eq!(format_bytes(1024), "1.0 KB");
        assert_eq!(format_bytes(1_048_576), "1.0 MB");
        assert_eq!(format_bytes(1_500_000), "1.4 MB");
    }

    #[test]
    fn test_parse_bytes() {
        assert_eq!(parse_bytes("1.5 MB"), Some(1_572_864));
        assert_eq!(parse_bytes("1024"), Some(1024));
        assert_eq!(parse_bytes("2GB"), Some(2_147_483_648));
    }

    #[test]
    fn test_exceeds() {
        assert!(exceeds(2_000_000, "1 MB"));
        assert!(!exceeds(500_000, "1 MB"));
    }
}
