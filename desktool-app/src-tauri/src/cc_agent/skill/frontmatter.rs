// skill/frontmatter.rs — SKILL.md YAML frontmatter 解析器
// 对齐 cc-gui SkillFrontmatterParser，使用简单字符串解析代替完整 YAML parser

use std::collections::HashMap;
use std::path::{Path, PathBuf};

const DESCRIPTION_MAX_LENGTH: usize = 1024;

/// 解析后的 Skill 元数据
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SkillMetadata {
    pub name: String,
    pub description: String,
    pub license: Option<String>,
    pub compatibility: Option<String>,
    #[serde(rename = "allowedTools")]
    pub allowed_tools: Option<String>,
    #[serde(rename = "userInvocable")]
    pub user_invocable: bool,
    pub paths: Vec<String>,
}

impl Default for SkillMetadata {
    fn default() -> Self {
        Self {
            name: String::new(),
            description: String::new(),
            license: None,
            compatibility: None,
            allowed_tools: None,
            user_invocable: true,
            paths: Vec::new(),
        }
    }
}

/// 定位 SKILL.md 文件（先查 SKILL.md，再查 skill.md 兜底）
pub fn locate_skill_md(skill_dir: &Path) -> Option<PathBuf> {
    let upper = skill_dir.join("SKILL.md");
    if upper.is_file() {
        return Some(upper);
    }
    let lower = skill_dir.join("skill.md");
    if lower.is_file() {
        return Some(lower);
    }
    None
}

/// 提取 YAML frontmatter 文本（--- 之间的内容）
pub fn extract_frontmatter_text(file_path: &Path) -> Option<String> {
    let content = std::fs::read_to_string(file_path).ok()?;

    if !content.starts_with("---") {
        return None;
    }

    // 查找第二个 --- 分隔符
    let after_first = &content[3..]; // skip opening ---
    let closing = after_first.find("\n---")?;

    let yaml = after_first[..closing].trim().to_string();
    if yaml.is_empty() {
        None
    } else {
        Some(yaml)
    }
}

/// 简易 YAML key-value 解析（不依赖 serde_yaml）
/// 仅支持 `key: value` 和 `key:` 后跟列表的格式
fn parse_simple_yaml(yaml_text: &str) -> HashMap<String, YamlValue> {
    let mut map = HashMap::new();
    let mut current_key: Option<String> = None;
    let mut current_list: Vec<String> = Vec::new();

    for line in yaml_text.lines() {
        // 跳过空行和注释
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            // 空行结束当前列表
            if let Some(ref key) = current_key {
                if !current_list.is_empty() {
                    map.insert(key.clone(), YamlValue::List(std::mem::take(&mut current_list)));
                }
                current_key = None;
            }
            continue;
        }

        // 检查列表项：`- value`
        if trimmed.starts_with("- ") || trimmed == "-" {
            let list_val = if trimmed.len() > 1 {
                trimmed[2..].trim().to_string()
            } else {
                String::new()
            };
            if !list_val.is_empty() {
                current_list.push(list_val);
            }
            continue;
        }

        // 先保存当前列表
        if let Some(ref key) = current_key {
            if !current_list.is_empty() {
                map.insert(key.clone(), YamlValue::List(std::mem::take(&mut current_list)));
            }
            current_key = None;
        }

        // 解析 key: value
        if let Some(colon_idx) = trimmed.find(':') {
            let key = trimmed[..colon_idx].trim().to_string();
            let value = trimmed[colon_idx + 1..].trim().to_string();

            if value.is_empty() {
                // 可能是列表的开始
                current_key = Some(key);
                current_list.clear();
            } else {
                // 移除引号
                let clean_value = value.trim_matches(&['"', '\''][..]).to_string();
                map.insert(key, YamlValue::Scalar(clean_value));
            }
        }
    }

    // 保存最后一个列表
    if let Some(ref key) = current_key {
        if !current_list.is_empty() {
            map.insert(key.clone(), YamlValue::List(current_list));
        }
    }

    map
}

#[derive(Debug, Clone)]
enum YamlValue {
    Scalar(String),
    List(Vec<String>),
}

impl YamlValue {
    fn as_str(&self) -> Option<&str> {
        match self {
            YamlValue::Scalar(s) => Some(s.as_str()),
            _ => None,
        }
    }

    fn as_string_list(&self) -> Vec<String> {
        match self {
            YamlValue::List(v) => v.clone(),
            YamlValue::Scalar(s) => vec![s.clone()],
        }
    }
}

/// 从 SKILL.md 正文提取第一个段落（用作 description fallback）
fn extract_first_paragraph(file_path: &Path) -> Option<String> {
    let content = std::fs::read_to_string(file_path).ok()?;

    if !content.starts_with("---") {
        return None;
    }

    // 跳过 frontmatter
    let after_first = &content[3..];
    let closing = after_first.find("\n---")?;
    let after_closing = &after_first[closing + 4..]; // skip "\n---"

    // 跳过 --- 后的换行符
    let body_start = after_closing.find('\n').map(|i| i + 1).unwrap_or(0);
    if body_start >= after_closing.len() {
        return None;
    }
    let body = after_closing[body_start..].trim_start().to_string();
    if body.is_empty() {
        return None;
    }

    // 取第一个空白行之前的内容作为第一段
    let first_para = match body.find("\n\n") {
        Some(idx) => body[..idx].to_string(),
        None => body,
    };

    // 去掉开头的 markdown 标题标记
    let cleaned = first_para.trim().trim_start_matches(|c: char| c == '#').trim().to_string();
    if cleaned.is_empty() {
        return None;
    }

    Some(if cleaned.len() > DESCRIPTION_MAX_LENGTH {
        cleaned[..DESCRIPTION_MAX_LENGTH].to_string()
    } else {
        cleaned
    })
}

/// 解析 SKILL.md 的完整 frontmatter 元数据
pub fn parse_skill_metadata(skill_dir: &Path) -> Option<SkillMetadata> {
    let skill_md = locate_skill_md(skill_dir)?;
    let yaml_text = extract_frontmatter_text(&skill_md)?;
    let yaml_map = parse_simple_yaml(&yaml_text);

    // 1. 提取 name（fallback 到目录名）
    let dir_name = skill_dir.file_name()?.to_string_lossy().to_string();
    let name = yaml_map
        .get("name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .filter(|s| super::validation::is_valid_skill_name(s))
        .unwrap_or(dir_name);

    // 2. 提取 description（fallback 到第一段）
    let description = yaml_map
        .get("description")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty())
        .or_else(|| extract_first_paragraph(&skill_md))
        .unwrap_or_default();

    // 截断过长 description
    let description = if description.len() > DESCRIPTION_MAX_LENGTH {
        description[..DESCRIPTION_MAX_LENGTH].to_string()
    } else {
        description
    };

    // 3. 可选字段
    let license = yaml_map.get("license").and_then(|v| v.as_str()).map(|s| s.to_string());
    let compatibility = yaml_map.get("compatibility").and_then(|v| v.as_str()).map(|s| s.to_string());
    let allowed_tools = yaml_map.get("allowed-tools").and_then(|v| v.as_str()).map(|s| s.to_string());

    // 4. user-invocable（默认 true）
    let user_invocable = yaml_map
        .get("user-invocable")
        .and_then(|v| v.as_str())
        .map(|s| s.parse::<bool>().unwrap_or(true))
        .unwrap_or(true);

    // 5. paths（条件激活的 glob 模式列表）
    let paths = yaml_map
        .get("paths")
        .map(|v| v.as_string_list())
        .unwrap_or_default();

    Some(SkillMetadata {
        name,
        description,
        license,
        compatibility,
        allowed_tools,
        user_invocable,
        paths,
    })
}

/// 便利方法：仅提取 description
pub fn extract_description(skill_dir: &Path) -> Option<String> {
    parse_skill_metadata(skill_dir).map(|m| m.description)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn create_temp_skill(name: &str, frontmatter: &str, body: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("skill_ft_test_{}", name));
        let _ = fs::remove_dir_all(&dir);
        let skill_dir = dir.join(name);
        fs::create_dir_all(&skill_dir).unwrap();

        let content = format!("---\n{}\n---\n\n{}", frontmatter.trim(), body);
        let skill_md = skill_dir.join("SKILL.md");
        fs::write(&skill_md, content).unwrap();

        dir
    }

    fn cleanup(dir: &std::path::Path) {
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn test_locate_skill_md() {
        let dir = std::env::temp_dir().join("skill_locate_test");
        let _ = fs::remove_dir_all(&dir);
        let skill_dir = dir.join("test-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(skill_dir.join("SKILL.md"), "---\nname: test\n---\n# Test").unwrap();
        assert!(locate_skill_md(&skill_dir).is_some());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_locate_skill_md_lowercase_fallback() {
        let dir = std::env::temp_dir().join("skill_locate_lower_test");
        let _ = fs::remove_dir_all(&dir);
        let skill_dir = dir.join("test-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(skill_dir.join("skill.md"), "---\nname: test\n---\n# Test").unwrap();
        assert!(locate_skill_md(&skill_dir).is_some());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_extract_frontmatter() {
        let dir = std::env::temp_dir().join("skill_fm_extract_test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let md = dir.join("test.md");
        fs::write(&md, "---\nname: hello\ndescription: A test\n---\n\n# Hello").unwrap();

        let text = extract_frontmatter_text(&md).unwrap();
        assert!(text.contains("name: hello"));
        assert!(text.contains("description: A test"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_parse_metadata() {
        let dir = create_temp_skill(
            "commit",
            "name: commit\ndescription: Generate commit messages\nuser-invocable: true",
            "# Commit Skill\n\nHelps with git commits.",
        );

        let metadata = parse_skill_metadata(&dir.join("commit")).unwrap();
        assert_eq!(metadata.name, "commit");
        assert_eq!(metadata.description, "Generate commit messages");
        assert!(metadata.user_invocable);
        cleanup(&dir);
    }

    #[test]
    fn test_parse_metadata_fallback_description() {
        let dir = create_temp_skill(
            "review",
            "name: review\nuser-invocable: true",
            "# Code Review\n\nReviews pull requests for best practices.",
        );

        let metadata = parse_skill_metadata(&dir.join("review")).unwrap();
        assert_eq!(metadata.name, "review");
        assert!(metadata.description.contains("reviews") || metadata.description.contains("Code Review"));
        cleanup(&dir);
    }

    #[test]
    fn test_parse_paths_list() {
        let dir = create_temp_skill(
            "react",
            "name: react\ndescription: React helper\npaths:\n  - \"*.tsx\"\n  - \"*.jsx\"",
            "# React Skill",
        );

        let metadata = parse_skill_metadata(&dir.join("react")).unwrap();
        assert_eq!(metadata.name, "react");
        assert!(!metadata.paths.is_empty());
        assert!(metadata.paths.iter().any(|p| p.contains("tsx")));
        cleanup(&dir);
    }
}
