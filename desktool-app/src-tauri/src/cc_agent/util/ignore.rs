// util/ignore.rs — Gitignore 风格 glob 匹配
// 对齐 cc-gui IgnoreRuleMatcher + IgnoreRuleParser

use regex::Regex;
use std::sync::OnceLock;
use std::path::Path;

/// 简化的 gitignore 规则匹配器
pub struct IgnoreMatcher {
    patterns: Vec<IgnorePattern>,
}

struct IgnorePattern {
    negated: bool,
    regex: Regex,
}

impl IgnoreMatcher {
    /// 从规则列表创建匹配器
    pub fn new(rules: &[String]) -> Self {
        let patterns = rules
            .iter()
            .filter_map(|rule| parse_rule(rule))
            .collect();
        Self { patterns }
    }

    /// 判断路径是否被忽略（返回 true = 忽略）
    pub fn is_ignored(&self, path: &str) -> bool {
        let mut ignored = false;
        for pattern in &self.patterns {
            let matches = pattern.regex.is_match(path);
            if pattern.negated {
                if matches {
                    ignored = false;
                }
            } else if matches {
                ignored = true;
            }
        }
        ignored
    }

    /// 判断路径是否被匹配（不忽略）
    pub fn is_allowed(&self, path: &str) -> bool {
        !self.is_ignored(path)
    }
}

/// 解析单条 gitignore 规则为正则
fn parse_rule(rule: &str) -> Option<IgnorePattern> {
    let rule = rule.trim();
    if rule.is_empty() || rule.starts_with('#') {
        return None;
    }

    let negated = rule.starts_with('!');
    let pattern = if negated { &rule[1..] } else { rule };
    let pattern = pattern.trim();

    if pattern.is_empty() {
        return None;
    }

    let regex_str = glob_to_regex(pattern);
    let regex = Regex::new(&format!("^{}$", regex_str)).ok()?;

    Some(IgnorePattern { negated, regex })
}

/// 将 glob 模式转换为正则
fn glob_to_regex(glob: &str) -> String {
    let mut result = String::new();
    let chars: Vec<char> = glob.chars().collect();
    let mut i = 0;

    // 处理开头的 /（锚定到根）
    let anchored = chars.first() == Some(&'/');
    if anchored {
        i = 1;
    }

    // 允许任意前缀（除非锚定）
    if !anchored {
        result.push_str("(.*/)?");
    }

    while i < chars.len() {
        match chars[i] {
            '*' => {
                // 检查 **（跨目录）
                if i + 1 < chars.len() && chars[i + 1] == '*' {
                    if i + 2 < chars.len() && chars[i + 2] == '/' {
                        result.push_str(".*");
                        i += 3;
                        continue;
                    }
                }
                result.push_str("[^/]*");
            }
            '?' => result.push('.'),
            '.' => result.push_str("\\."),
            '+' | '^' | '$' | '(' | ')' | '{' | '}' | '[' | ']' | '|' | '\\' => {
                result.push('\\');
                result.push(chars[i]);
            }
            '/' => {
                // 如果末尾是 /，表示匹配目录
                if i == chars.len() - 1 {
                    result.push_str("(?:/.*)?");
                    break;
                }
                result.push('/');
            }
            c => result.push(c),
        }
        i += 1;
    }

    // 如果末尾有 **，允许任意后缀
    if glob.ends_with("**") {
        result.push_str(".*");
    }

    result
}

/// 简化的路径匹配（支持 *、**、?）
pub fn simple_glob(pattern: &str, path: &str) -> bool {
    let regex_str = glob_to_regex(pattern);
    if let Ok(re) = Regex::new(&format!("^{}$", regex_str)) {
        re.is_match(path)
    } else {
        false
    }
}

/// 判断路径是否匹配多个 glob 模式之一
pub fn matches_any(path: &str, patterns: &[String]) -> bool {
    patterns.iter().any(|p| simple_glob(p, path))
}

/// 通用文件名模式匹配（如 "*.rs"）
pub fn match_filename(path: &Path, pattern: &str) -> bool {
    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        simple_glob(pattern, name)
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_glob() {
        assert!(simple_glob("*.rs", "main.rs"));
        assert!(!simple_glob("*.java", "main.rs"));
        assert!(simple_glob("src/**/*.rs", "src/foo/bar/main.rs"));
        assert!(!simple_glob("src/**/*.rs", "test/main.rs"));
        assert!(simple_glob("test?.rs", "test1.rs"));
        assert!(!simple_glob("test?.rs", "test12.rs"));
    }

    #[test]
    fn test_ignore_matcher() {
        let rules = vec![
            "*.log".to_string(),
            "!important.log".to_string(),
            "target/".to_string(),
        ];
        let matcher = IgnoreMatcher::new(&rules);

        assert!(matcher.is_ignored("debug.log"));
        assert!(!matcher.is_ignored("important.log"));
        assert!(matcher.is_ignored("target/some/file"));
        assert!(!matcher.is_ignored("src/main.rs"));
    }

    #[test]
    fn test_matches_any() {
        let patterns: Vec<String> = vec!["*.rs".into(), "*.ts".into()];
        assert!(matches_any("main.rs", &patterns));
        assert!(matches_any("app.ts", &patterns));
        assert!(!matches_any("README.md", &patterns));
    }

    #[test]
    fn test_match_filename() {
        assert!(match_filename(Path::new("/src/main.rs"), "*.rs"));
        assert!(!match_filename(Path::new("/src/main.rs"), "*.java"));
    }
}
