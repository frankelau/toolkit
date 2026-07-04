// skill/scanner.rs — Skill 目录扫描器
// 对齐 cc-gui SkillService.scanSkillsDirectory

use std::fs;
use std::path::{Path, PathBuf};

use super::frontmatter::{parse_skill_metadata, SkillMetadata};
use super::validation::is_safe_skill_name;

/// 单个 Skill 条目（扫描结果）
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SkillEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(rename = "type")]
    pub entry_type: String, // "directory" | "file"
    pub scope: String,      // "global" | "local"
    pub path: String,
    pub enabled: bool,
    pub metadata: Option<SkillMetadata>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<String>,
    #[serde(rename = "modifiedAt")]
    pub modified_at: Option<String>,
}

/// 扫描结果
#[derive(Debug, Clone, serde::Serialize)]
pub struct ScanResult {
    pub skills: Vec<SkillEntry>,
    pub count: usize,
}

/// 扫描指定目录，发现所有 skill
///
/// # Arguments
/// * `dir_path` - 技能目录路径
/// * `scope` - 作用域 (global/local)
/// * `enabled` - 是否已启用
pub fn scan_skills_directory(dir_path: &Path, scope: &str, enabled: bool) -> ScanResult {
    let mut skills = Vec::new();

    if !dir_path.exists() {
        return ScanResult { skills, count: 0 };
    }

    let entries = match fs::read_dir(dir_path) {
        Ok(e) => e,
        Err(_) => return ScanResult { skills, count: 0 },
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        // 跳过隐藏文件/目录
        if file_name.starts_with('.') {
            continue;
        }

        // 只处理目录（Agent Skills 规范要求）
        if !path.is_dir() {
            continue;
        }

        // 检查名称安全性
        if !is_safe_skill_name(&file_name) {
            continue;
        }

        // 构建 ID（包含启用/禁用标记以区分同名）
        let id = if enabled {
            format!("{}-{}", scope, file_name)
        } else {
            format!("{}-{}-disabled", scope, file_name)
        };

        let mut skill = SkillEntry {
            id,
            name: file_name.clone(),
            description: String::new(),
            entry_type: "directory".to_string(),
            scope: scope.to_string(),
            path: path.to_string_lossy().to_string(),
            enabled,
            metadata: None,
            created_at: None,
            modified_at: None,
        };

        // 解析 frontmatter
        if let Some(metadata) = parse_skill_metadata(&path) {
            skill.name = metadata.name.clone();
            skill.description = metadata.description.clone();
            skill.metadata = Some(metadata);
        } else {
            // frontmatter 解析失败，保留目录名作为名称
            skill.name = file_name;
        }

        // 读取文件时间属性
        if let Ok(metadata) = fs::metadata(&path) {
            if let Ok(modified) = metadata.modified() {
                skill.modified_at = Some(format!("{:?}", modified));
            }
            if let Ok(created) = metadata.created() {
                skill.created_at = Some(format!("{:?}", created));
            }
        }

        skills.push(skill);
    }

    let count = skills.len();
    ScanResult { skills, count }
}

/// 递归扫描目录，收集所有 .md skill 文件（用于简单类型）
pub fn scan_simple_skills(cwd: &str) -> Vec<SkillEntry> {
    let skills_dir = PathBuf::from(cwd).join(".agents").join("skills");
    let mut skills = Vec::new();

    if !skills_dir.exists() {
        return skills;
    }

    let entries = match fs::read_dir(&skills_dir) {
        Ok(e) => e,
        Err(_) => return skills,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let name = entry.file_name().to_string_lossy().to_string();
            let skill_file = path.join("SKILL.md");

            if !is_safe_skill_name(&name) {
                continue;
            }

            let description = if skill_file.exists() {
                fs::read_to_string(&skill_file)
                    .ok()
                    .and_then(|content| {
                        content
                            .lines()
                            .skip_while(|l| l.starts_with('#'))
                            .find(|l| !l.trim().is_empty())
                            .map(|l| l.trim().to_string())
                    })
                    .unwrap_or_default()
            } else {
                String::new()
            };

            let metadata = parse_skill_metadata(&path);

            skills.push(SkillEntry {
                id: format!("local-{}", name),
                name: name.clone(),
                description,
                entry_type: "directory".to_string(),
                scope: "local".to_string(),
                path: path.to_string_lossy().to_string(),
                enabled: true,
                metadata,
                created_at: None,
                modified_at: None,
            });
        }
    }

    skills
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scan_empty_directory() {
        let dir = std::env::temp_dir().join("empty_skills_test");
        let _ = fs::create_dir_all(&dir);
        let result = scan_skills_directory(&dir, "global", true);
        assert_eq!(result.count, 0);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_scan_directory_with_skill() {
        let dir = std::env::temp_dir().join("test_skills_scan");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("commit")).unwrap();
        fs::write(
            dir.join("commit").join("SKILL.md"),
            "---\nname: commit\ndescription: Generate commit messages\n---\n\n# Commit Skill",
        )
        .unwrap();

        let result = scan_skills_directory(&dir, "global", true);
        assert_eq!(result.count, 1);
        assert_eq!(result.skills[0].name, "commit");
        assert!(result.skills[0].description.contains("commit"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_scan_skips_hidden_dirs() {
        let dir = std::env::temp_dir().join("test_hidden_skills");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join(".hidden")).unwrap();
        fs::create_dir_all(dir.join("visible")).unwrap();
        fs::write(dir.join("visible").join("SKILL.md"), "---\nname: visible\n---\n\n# OK").unwrap();

        let result = scan_skills_directory(&dir, "global", true);
        assert_eq!(result.count, 1);
        assert_eq!(result.skills[0].name, "visible");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_disabled_skills_have_disabled_suffix() {
        let dir = std::env::temp_dir().join("test_disabled_scan");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("review")).unwrap();
        fs::write(dir.join("review").join("SKILL.md"), "---\nname: review\n---\n\n# Review").unwrap();

        let result = scan_skills_directory(&dir, "global", false);
        assert_eq!(result.count, 1);
        assert!(result.skills[0].id.ends_with("-disabled"));

        let _ = fs::remove_dir_all(&dir);
    }
}
