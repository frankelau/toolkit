// util/token.rs — Token 估算工具
// 对齐 cc-gui TokenUsageUtils (简化版)

/// 估算文本的 token 数（粗略：英文 1 token ≈ 4 chars，中文 1 token ≈ 1 char）
pub fn estimate_tokens(text: &str) -> usize {
    let mut count = 0f64;
    for c in text.chars() {
        if c.is_ascii_alphabetic() || c.is_ascii_digit() {
            count += 0.25;
        } else if c.is_whitespace() {
            count += 0.25;
        } else if c.is_ascii_punctuation() {
            count += 0.3;
        } else {
            count += 1.0; // CJK and other multibyte
        }
    }
    count.ceil() as usize
}

/// 简单估算（按字符数 / 4）
pub fn estimate_tokens_fast(text: &str) -> usize {
    (text.len() as f64 / 3.5).ceil() as usize
}

/// 获取字符数
pub fn char_count(text: &str) -> usize {
    text.chars().count()
}

/// 获取行数
pub fn line_count(text: &str) -> usize {
    text.lines().count()
}

/// 获取单词数（英文）
pub fn word_count(text: &str) -> usize {
    text.split_whitespace().count()
}

/// 格式化 token 数量
pub fn format_tokens(count: usize) -> String {
    if count >= 1_000_000 {
        format!("{:.1}M", count as f64 / 1_000_000.0)
    } else if count >= 1_000 {
        format!("{:.1}K", count as f64 / 1_000.0)
    } else {
        count.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_estimate_tokens_english() {
        let text = "Hello world, this is a test sentence.";
        let tokens = estimate_tokens(text);
        assert!(tokens > 0);
        assert!(tokens < text.len() / 2); // English is roughly 0.25 tokens/char
    }

    #[test]
    fn test_estimate_tokens_chinese() {
        let text = "这是一段中文测试文本";
        let tokens = estimate_tokens(text);
        assert!(tokens >= text.chars().count());
    }

    #[test]
    fn test_format_tokens() {
        assert_eq!(format_tokens(500), "500");
        assert_eq!(format_tokens(2_500), "2.5K");
        assert_eq!(format_tokens(1_500_000), "1.5M");
    }
}
