// util/strings.rs — 字符串工具
// 对齐 cc-gui LineSeparatorUtil + TokenUsageUtils (字符串部分)

/// 截断字符串到指定长度（添加省略号）
pub fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else if max_len <= 3 {
        "..".to_string()
    } else {
        format!("{}...", &s[..max_len - 3])
    }
}

/// 截断到指定行数
pub fn truncate_lines(s: &str, max_lines: usize) -> String {
    let lines: Vec<&str> = s.lines().collect();
    if lines.len() <= max_lines {
        s.to_string()
    } else {
        let mut result = lines[..max_lines].join("\n");
        result.push_str("\n...");
        result
    }
}

/// 首字母大写
pub fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

/// 驼峰转蛇形（myVar → my_var）
pub fn camel_to_snake(s: &str) -> String {
    let mut result = String::new();
    for (i, c) in s.chars().enumerate() {
        if c.is_uppercase() {
            if i > 0 {
                result.push('_');
            }
            result.push(c.to_ascii_lowercase());
        } else {
            result.push(c);
        }
    }
    result
}

/// 蛇形转驼峰（my_var → myVar）
pub fn snake_to_camel(s: &str) -> String {
    let mut result = String::new();
    let mut upper_next = false;
    for c in s.chars() {
        if c == '_' {
            upper_next = true;
        } else if upper_next {
            result.push(c.to_ascii_uppercase());
            upper_next = false;
        } else {
            result.push(c);
        }
    }
    result
}

/// 移除多余空白（标准化空格）
pub fn normalize_whitespace(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// 转换为 slug（小写+连字符）
pub fn slugify(s: &str) -> String {
    let lower = s.to_lowercase();
    let mut result = String::new();
    for c in lower.chars() {
        if c.is_alphanumeric() {
            result.push(c);
        } else if !result.ends_with('-') {
            result.push('-');
        }
    }
    result.trim_matches('-').to_string()
}

/// 通配符匹配（仅支持 * 和 ?）
pub fn wildcard_match(pattern: &str, input: &str) -> bool {
    let chars_p: Vec<char> = pattern.chars().collect();
    let chars_i: Vec<char> = input.chars().collect();
    let (np, ni) = (chars_p.len(), chars_i.len());
    let mut dp = vec![vec![false; ni + 1]; np + 1];
    dp[0][0] = true;

    for i in 1..=np {
        if chars_p[i - 1] == '*' {
            dp[i][0] = dp[i - 1][0];
        }
    }

    for i in 1..=np {
        for j in 1..=ni {
            if chars_p[i - 1] == '*' {
                dp[i][j] = dp[i - 1][j] || dp[i][j - 1];
            } else if chars_p[i - 1] == '?' || chars_p[i - 1] == chars_i[j - 1] {
                dp[i][j] = dp[i - 1][j - 1];
            }
        }
    }

    dp[np][ni]
}

/// 简单莱文斯坦距离
pub fn levenshtein(a: &str, b: &str) -> usize {
    let (a, b) = (a.chars().collect::<Vec<_>>(), b.chars().collect::<Vec<_>>());
    let (na, nb) = (a.len(), b.len());
    let mut dp = vec![vec![0usize; nb + 1]; na + 1];

    for i in 0..=na {
        dp[i][0] = i;
    }
    for j in 0..=nb {
        dp[0][j] = j;
    }
    for i in 1..=na {
        for j in 1..=nb {
            let cost = if a[i - 1] == b[j - 1] { 0 } else { 1 };
            dp[i][j] = (dp[i - 1][j] + 1)
                .min(dp[i][j - 1] + 1)
                .min(dp[i - 1][j - 1] + cost);
        }
    }
    dp[na][nb]
}

/// 限制字符串字节数（UTF-8 safe）
pub fn truncate_bytes(s: &str, max_bytes: usize) -> &str {
    if s.len() <= max_bytes {
        return s;
    }
    let mut end = max_bytes;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    &s[..end]
}

/// 判断是否为空白字符串
pub fn is_blank(s: &str) -> bool {
    s.trim().is_empty()
}

/// 生成缩进
pub fn indent(level: usize) -> String {
    "  ".repeat(level)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_truncate() {
        assert_eq!(truncate("hello", 10), "hello");
        assert_eq!(truncate("hello world", 8), "hello...");
    }

    #[test]
    fn test_camel_snake() {
        assert_eq!(camel_to_snake("myVarName"), "my_var_name");
        assert_eq!(snake_to_camel("my_var_name"), "myVarName");
    }

    #[test]
    fn test_slugify() {
        assert_eq!(slugify("Hello World!"), "hello-world");
        assert_eq!(slugify("My--Skill"), "my-skill");
    }

    #[test]
    fn test_wildcard_match() {
        assert!(wildcard_match("*.rs", "main.rs"));
        assert!(wildcard_match("test-*", "test-util"));
        assert!(!wildcard_match("*.java", "main.rs"));
    }

    #[test]
    fn test_levenshtein() {
        assert_eq!(levenshtein("kitten", "sitting"), 3);
        assert_eq!(levenshtein("abc", "abc"), 0);
    }

    #[test]
    fn test_truncate_lines() {
        let s = "line1\nline2\nline3\nline4";
        assert_eq!(truncate_lines(s, 2), "line1\nline2\n...");
    }
}
