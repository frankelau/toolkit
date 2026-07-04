// util/sanitizer.rs — 文本清理工具
// 对齐 cc-gui TextSanitizer + UserMessageSanitizer

/// 清理用户输入（移除控制字符，但保留常用空白和换行）
pub fn sanitize_user_message(input: &str) -> String {
    input
        .chars()
        .filter(|&c| {
            c == '\n' || c == '\r' || c == '\t' || !c.is_control()
        })
        .collect()
}

/// 移除所有控制字符（包括换行/制表）
pub fn strip_control_chars(input: &str) -> String {
    input.chars().filter(|&c| !c.is_control()).collect()
}

/// 标准化为安全文件名（替换非法字符为下划线）
pub fn to_safe_filename(name: &str) -> String {
    let mut result = String::new();
    for c in name.chars() {
        if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' {
            result.push(c);
        } else {
            result.push('_');
        }
    }
    // 不能以点或连字符开头
    if result.starts_with('.') || result.starts_with('-') {
        result = format!("_{}", &result[1..]);
    }
    if result.is_empty() {
        result = "_".to_string();
    }
    result
}

/// 移除 ANSI 转义序列（颜色码等）
pub fn strip_ansi(input: &str) -> String {
    let re = regex::Regex::new(r"\x1b\[[0-9;]*[a-zA-Z]").unwrap();
    re.replace_all(input, "").to_string()
}

/// 压缩连续空行为单空行，最大连续空行数
pub fn normalize_blank_lines(input: &str, max_consecutive: usize) -> String {
    let mut result = String::new();
    let mut blank_count = 0;

    for line in input.lines() {
        if line.trim().is_empty() {
            blank_count += 1;
            if blank_count <= max_consecutive {
                result.push('\n');
            }
        } else {
            blank_count = 0;
            if !result.is_empty() && !result.ends_with('\n') {
                result.push('\n');
            }
            result.push_str(line);
        }
    }

    result.trim_end().to_string()
}

/// HTML 转义
pub fn escape_html(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

/// JSON 字符串转义
pub fn escape_json(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    for c in input.chars() {
        match c {
            '"' => result.push_str("\\\""),
            '\\' => result.push_str("\\\\"),
            '\n' => result.push_str("\\n"),
            '\r' => result.push_str("\\r"),
            '\t' => result.push_str("\\t"),
            c if c.is_control() => {
                result.push_str(&format!("\\u{:04x}", c as u32));
            }
            c => result.push(c),
        }
    }
    result
}

/// 限制字符串长度，超长则中间截断
pub fn ellipsize_middle(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        return s.to_string();
    }
    let keep = (max_len - 3) / 2;
    if keep < 2 {
        let trunc_len = max_len.saturating_sub(3);
        if trunc_len == 0 || trunc_len >= s.len() {
            return s.to_string();
        }
        return format!("{}...", &s[..trunc_len]);
    }
    format!("{}...{}", &s[..keep], &s[s.len() - keep..])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_user_message() {
        let input = "hello\x00world\n";
        let cleaned = sanitize_user_message(input);
        assert!(!cleaned.contains('\x00'));
        assert!(cleaned.contains('\n'));
    }

    #[test]
    fn test_to_safe_filename() {
        assert_eq!(to_safe_filename("my file.txt"), "my_file.txt");
        assert_eq!(to_safe_filename(".hidden"), "_hidden");
        assert_eq!(to_safe_filename("test<script>.js"), "test_script_.js");
    }

    #[test]
    fn test_strip_ansi() {
        let colored = "\x1b[31mred\x1b[0m text";
        assert_eq!(strip_ansi(colored), "red text");
    }

    #[test]
    fn test_escape_html() {
        assert_eq!(escape_html("<div class=\"x\">"), "&lt;div class=&quot;x&quot;&gt;");
    }

    #[test]
    fn test_ellipsize_middle() {
        assert_eq!(ellipsize_middle("hello world test", 10), "hel...est");
        assert_eq!(ellipsize_middle("short", 10), "short");
    }
}
