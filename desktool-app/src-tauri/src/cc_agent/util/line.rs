// util/line.rs — 换行符工具
// 对齐 cc-gui LineSeparatorUtil

/// 检测文本使用的换行符类型
pub fn detect_line_ending(text: &str) -> &'static str {
    let has_crlf = text.contains("\r\n");
    let has_lf = text.contains('\n');
    let has_cr = text.contains('\r');

    if has_crlf && !text.replace("\r\n", "").contains('\n') {
        "\r\n" // CRLF
    } else if has_cr && !has_lf {
        "\r" // CR (classic Mac)
    } else {
        "\n" // LF (Unix) or mixed
    }
}

/// 统一换行符为指定类型
pub fn normalize_line_endings(text: &str, target: &str) -> String {
    // 先统一为 LF
    let lf_only = text.replace("\r\n", "\n").replace('\r', "\n");
    // 再转为目标类型
    if target == "\r\n" {
        lf_only.replace('\n', "\r\n")
    } else if target == "\r" {
        lf_only.replace('\n', "\r")
    } else {
        lf_only
    }
}

/// 计算行数
pub fn count_lines(text: &str) -> usize {
    if text.is_empty() {
        0
    } else {
        text.lines().count()
    }
}

/// 获取指定行（0-indexed）
pub fn get_line(text: &str, line_no: usize) -> Option<&str> {
    text.lines().nth(line_no)
}

/// 获取行范围 [start, end)（0-indexed）
pub fn get_lines_range(text: &str, start: usize, end: usize) -> String {
    let lines: Vec<&str> = text.lines().collect();
    let end = end.min(lines.len());
    if start >= lines.len() {
        return String::new();
    }
    lines[start..end].join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_line_ending() {
        assert_eq!(detect_line_ending("hello\nworld"), "\n");
        assert_eq!(detect_line_ending("hello\r\nworld"), "\r\n");
    }

    #[test]
    fn test_normalize() {
        let text = "a\r\nb\nc";
        let normalized = normalize_line_endings(text, "\n");
        assert_eq!(normalized, "a\nb\nc");
        assert!(!normalized.contains('\r'));
    }

    #[test]
    fn test_count_lines() {
        assert_eq!(count_lines("a\nb\nc"), 3);
        assert_eq!(count_lines(""), 0);
        assert_eq!(count_lines("single"), 1);
    }
}
