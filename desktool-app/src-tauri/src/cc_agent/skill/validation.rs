// skill/validation.rs — Skill 名称验证与安全检查
// 对齐 cc-gui SkillService.isSafeSkillName + SkillFrontmatterParser.isValidSkillName

use regex::Regex;
use std::sync::OnceLock;

const NAME_MAX_LENGTH: usize = 64;

fn safe_name_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^[a-zA-Z0-9][a-zA-Z0-9._-]*$").unwrap())
}

fn agent_name_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$").unwrap())
}

fn consecutive_hyphens_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new("--").unwrap())
}

/// 检查 skill 名称是否安全（无路径穿越字符）
pub fn is_safe_skill_name(name: &str) -> bool {
    if name.is_empty() {
        return false;
    }
    if name.contains("..") || name.contains('/') || name.contains('\\') || name.contains('\0') {
        return false;
    }
    safe_name_re().is_match(name)
}

/// 检查是否为有效的 Agent Skills 规范名称
/// 小写字母数字 + 连字符，1-64 字符，不能以连字符开头/结尾，不能连续连字符
pub fn is_valid_skill_name(name: &str) -> bool {
    if name.is_empty() || name.len() > NAME_MAX_LENGTH {
        return false;
    }
    if consecutive_hyphens_re().is_match(name) {
        return false;
    }
    agent_name_re().is_match(name)
}

/// 清理并验证 skill 名称，返回清理后的名称或 None
pub fn sanitize_skill_name(name: &str) -> Option<String> {
    let cleaned = name.trim().to_lowercase();
    if is_valid_skill_name(&cleaned) {
        Some(cleaned)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safe_names() {
        assert!(is_safe_skill_name("commit"));
        assert!(is_safe_skill_name("my-skill"));
        assert!(is_safe_skill_name("skill_v2.0"));
        assert!(is_safe_skill_name("a")); // single char
    }

    #[test]
    fn test_unsafe_names() {
        assert!(!is_safe_skill_name(""));
        assert!(!is_safe_skill_name("../etc"));
        assert!(!is_safe_skill_name("path/to/skill"));
        assert!(!is_safe_skill_name("back\\slash"));
        assert!(!is_safe_skill_name("null\0char"));
    }

    #[test]
    fn test_valid_agent_names() {
        assert!(is_valid_skill_name("commit"));
        assert!(is_valid_skill_name("code-review"));
        assert!(is_valid_skill_name("test-runner-v2"));
        assert!(is_valid_skill_name("a")); // single char
    }

    #[test]
    fn test_invalid_agent_names() {
        assert!(!is_valid_skill_name(""));
        assert!(!is_valid_skill_name("-bad-start"));
        assert!(!is_valid_skill_name("bad-end-"));
        assert!(!is_valid_skill_name("bad--hyphens"));
        assert!(!is_valid_skill_name("UPPERCASE"));
        assert!(!is_valid_skill_name("has spaces"));
        assert!(!is_valid_skill_name(&"a".repeat(65))); // too long
    }

    #[test]
    fn test_sanitize() {
        assert_eq!(sanitize_skill_name("Commit"), Some("commit".into()));
        assert_eq!(sanitize_skill_name("  my-skill  "), Some("my-skill".into()));
        assert_eq!(sanitize_skill_name("BAD-NAME"), Some("bad-name".into()));
        assert_eq!(sanitize_skill_name(""), None);
    }
}
