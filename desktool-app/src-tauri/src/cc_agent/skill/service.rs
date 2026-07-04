// skill/service.rs — Skill 服务核心逻辑
// 对齐 cc-gui SkillService: CRUD + import + enable/disable + global/local scope

use std::fs;
use std::path::{Path, PathBuf};

use super::frontmatter::{parse_skill_metadata, SkillMetadata};
use super::scanner::{scan_skills_directory, SkillEntry};
use super::validation::is_safe_skill_name;

// ─── 目录路径 ────────────────────────────────────────────────────────────────────

/// 全局活跃 skills 目录 (~/.claude/skills)
pub fn global_skills_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude").join("skills"))
}

/// 本地活跃 skills 目录 ({workspace}/.claude/skills)
pub fn local_skills_dir(cwd: &str) -> Option<PathBuf> {
    if cwd.is_empty() {
        return None;
    }
    Some(PathBuf::from(cwd).join(".claude").join("skills"))
}

/// 全局管理目录 (~/.codemoss/skills/global) — 存放已禁用 skills
fn global_management_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".codemoss").join("skills").join("global"))
}

/// 本地管理目录 (~/.codemoss/skills/{project-hash}) — 存放已禁用 skills
fn local_management_dir(cwd: &str) -> Option<PathBuf> {
    if cwd.is_empty() {
        return None;
    }
    let project_name = PathBuf::from(cwd)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".into());
    let path_hash = format!("{:x}", cwd.len().wrapping_mul(31).wrapping_add(cwd.as_bytes().iter().fold(0usize, |h, &b| h.wrapping_mul(31).wrapping_add(b as usize))));
    let safe_dir = format!("{}_{}", project_name, path_hash);

    dirs::home_dir()
        .map(|h| h.join(".codemoss").join("skills").join(safe_dir))
}

/// 确保目录存在
fn ensure_dir(path: &Path) -> Result<(), String> {
    if !path.exists() {
        fs::create_dir_all(path).map_err(|e| format!("创建目录失败 {}: {}", path.display(), e))?;
    }
    Ok(())
}

// ─── 列出 Skills ──────────────────────────────────────────────────────────────

/// 获取所有 skills（global + local，含启用和禁用）
#[tauri::command]
pub async fn cc_list_all_skills(cwd: String) -> Result<serde_json::Value, String> {
    let mut result = serde_json::Map::new();

    // 全局启用
    let global_active = if let Some(dir) = global_skills_dir() {
        let scan = scan_skills_directory(&dir, "global", true);
        serde_json::to_value(scan.skills).unwrap_or_default()
    } else {
        serde_json::Value::Array(vec![])
    };
    result.insert("global".into(), global_active);

    // 全局禁用
    let global_disabled = if let Some(dir) = global_management_dir() {
        let scan = scan_skills_directory(&dir, "global", false);
        serde_json::to_value(scan.skills).unwrap_or_default()
    } else {
        serde_json::Value::Array(vec![])
    };
    result.insert("global_disabled".into(), global_disabled);

    // 本地启用
    let local_active = if let Some(dir) = local_skills_dir(&cwd) {
        let scan = scan_skills_directory(&dir, "local", true);
        serde_json::to_value(scan.skills).unwrap_or_default()
    } else {
        serde_json::Value::Array(vec![])
    };
    result.insert("local".into(), local_active);

    // 本地禁用
    let local_disabled = if let Some(dir) = local_management_dir(&cwd) {
        let scan = scan_skills_directory(&dir, "local", false);
        serde_json::to_value(scan.skills).unwrap_or_default()
    } else {
        serde_json::Value::Array(vec![])
    };
    result.insert("local_disabled".into(), local_disabled);

    Ok(serde_json::Value::Object(result))
}

/// 列出本地项目 skills（保持向后兼容）
#[tauri::command]
pub async fn cc_list_skills(cwd: String) -> Result<Vec<serde_json::Value>, String> {
    let skills_dir = std::path::Path::new(&cwd).join(".agents").join("skills");
    let mut skills = Vec::new();

    if !skills_dir.exists() {
        return Ok(skills);
    }

    if let Ok(entries) = fs::read_dir(&skills_dir) {
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
                let name_to_use = metadata.as_ref().map_or(&name, |m| &m.name);

                skills.push(serde_json::json!({
                    "name": name_to_use,
                    "description": description,
                    "path": path.to_string_lossy().to_string(),
                    "scope": "local",
                    "enabled": true,
                }));
            }
        }
    }

    Ok(skills)
}

// ─── 创建 Skill ──────────────────────────────────────────────────────────────

/// 创建 skill（写入 ~/.claude/skills/{name}/SKILL.md 或项目 .claude/skills/）
#[tauri::command]
pub async fn cc_create_skill(
    name: String,
    description: String,
    content: String,
    scope: Option<String>,
    cwd: Option<String>,
) -> Result<serde_json::Value, String> {
    // 验证名称
    if !is_safe_skill_name(&name) {
        return Err(format!("无效的 Skill 名称: {}", name));
    }

    let base_dir = match scope.as_deref() {
        Some("local") => {
            let cwd = cwd.as_deref().unwrap_or(".");
            local_skills_dir(cwd).ok_or("无法获取本地 skills 目录")?
        }
        _ => global_skills_dir().ok_or("无法获取全局 skills 目录")?,
    };
    let skill_dir = base_dir.join(&name);

    // 检查是否已存在
    if skill_dir.exists() {
        return Err(format!("Skill '{}' 已存在", name));
    }

    // 确保目录存在
    ensure_dir(&skill_dir)?;

    // 写入 SKILL.md
    let skill_md = format!(
        "---\nname: {}\ndescription: {}\n---\n\n{}",
        name, description, content
    );
    tokio::fs::write(skill_dir.join("SKILL.md"), skill_md)
        .await
        .map_err(|e| format!("写入失败: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "name": name,
        "path": skill_dir.to_string_lossy().to_string(),
        "scope": scope.as_deref().unwrap_or("global"),
        "enabled": true,
    }))
}

// ─── 删除 Skill ──────────────────────────────────────────────────────────────

/// 删除 skill（支持启用和禁用两种状态）
#[tauri::command]
pub async fn cc_delete_skill(
    name: String,
    scope: Option<String>,
    enabled: Option<bool>,
    cwd: Option<String>,
) -> Result<serde_json::Value, String> {
    if !is_safe_skill_name(&name) {
        return Err(format!("无效的 Skill 名称: {}", name));
    }

    let is_enabled = enabled.unwrap_or(true);

    let dir = get_skill_dir(&name, scope.as_deref(), is_enabled, cwd.as_deref())?;

    if !dir.exists() {
        return Err(serde_json::json!({
            "success": false,
            "error": format!("Skill '{}' 不存在", name),
        }).to_string());
    }

    if dir.is_dir() {
        tokio::fs::remove_dir_all(&dir)
            .await
            .map_err(|e| format!("删除失败: {}", e))?;
    } else {
        tokio::fs::remove_file(&dir)
            .await
            .map_err(|e| format!("删除失败: {}", e))?;
    }

    Ok(serde_json::json!({
        "success": true,
        "name": name,
        "scope": scope.as_deref().unwrap_or("global"),
    }))
}

// ─── 启用/禁用 Skill ──────────────────────────────────────────────────────

/// 启用一个已禁用的 skill（从管理目录移到活跃目录）
#[tauri::command]
pub async fn cc_enable_skill(
    name: String,
    scope: Option<String>,
    cwd: Option<String>,
) -> Result<serde_json::Value, String> {
    if !is_safe_skill_name(&name) {
        return Err(format!("无效的 Skill 名称: {}", name));
    }

    let is_local = scope.as_deref() == Some("local");
    let source_dir = if is_local {
        local_management_dir(cwd.as_deref().unwrap_or("."))
            .ok_or("无法获取本地管理目录")?
    } else {
        global_management_dir().ok_or("无法获取全局管理目录")?
    };
    let target_dir = if is_local {
        local_skills_dir(cwd.as_deref().unwrap_or("."))
            .ok_or("无法获取本地 skills 目录")?
    } else {
        global_skills_dir().ok_or("无法获取全局 skills 目录")?
    };

    let source = source_dir.join(&name);
    let target = target_dir.join(&name);

    if !source.exists() {
        return Err(serde_json::json!({
            "success": false,
            "error": format!("Skill '{}' 在管理目录中不存在", name),
        }).to_string());
    }
    if target.exists() {
        return Err(serde_json::json!({
            "success": false,
            "error": format!("Skill '{}' 已在活跃目录中存在", name),
            "conflict": true,
        }).to_string());
    }

    ensure_dir(&target_dir)?;
    fs::rename(&source, &target)
        .map_err(|e| format!("移动失败: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "name": name,
        "scope": scope.as_deref().unwrap_or("global"),
        "enabled": true,
        "path": target.to_string_lossy().to_string(),
    }))
}

/// 禁用一个已启用的 skill（从活跃目录移到管理目录）
#[tauri::command]
pub async fn cc_disable_skill(
    name: String,
    scope: Option<String>,
    cwd: Option<String>,
) -> Result<serde_json::Value, String> {
    if !is_safe_skill_name(&name) {
        return Err(format!("无效的 Skill 名称: {}", name));
    }

    let is_local = scope.as_deref() == Some("local");
    let source_dir = if is_local {
        local_skills_dir(cwd.as_deref().unwrap_or("."))
            .ok_or("无法获取本地 skills 目录")?
    } else {
        global_skills_dir().ok_or("无法获取全局 skills 目录")?
    };
    let target_dir = if is_local {
        local_management_dir(cwd.as_deref().unwrap_or("."))
            .ok_or("无法获取本地管理目录")?
    } else {
        global_management_dir().ok_or("无法获取全局管理目录")?
    };

    let source = source_dir.join(&name);
    let target = target_dir.join(&name);

    if !source.exists() {
        return Err(serde_json::json!({
            "success": false,
            "error": format!("Skill '{}' 在活跃目录中不存在", name),
        }).to_string());
    }
    if target.exists() {
        return Err(serde_json::json!({
            "success": false,
            "error": format!("Skill '{}' 已在管理目录中存在", name),
            "conflict": true,
        }).to_string());
    }

    ensure_dir(&target_dir)?;
    fs::rename(&source, &target)
        .map_err(|e| format!("移动失败: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "name": name,
        "scope": scope.as_deref().unwrap_or("global"),
        "enabled": false,
        "path": target.to_string_lossy().to_string(),
    }))
}

/// 切换启用/禁用状态
#[tauri::command]
pub async fn cc_toggle_skill(
    name: String,
    scope: Option<String>,
    current_enabled: Option<bool>,
    cwd: Option<String>,
) -> Result<serde_json::Value, String> {
    if current_enabled.unwrap_or(true) {
        cc_disable_skill(name, scope, cwd).await
    } else {
        cc_enable_skill(name, scope, cwd).await
    }
}

// ─── 导入 Skill ──────────────────────────────────────────────────────────────

/// 导入 skill（从文件/目录复制到 skills 目录）
#[tauri::command]
pub async fn cc_import_skill(
    source_path: String,
    scope: Option<String>,
    cwd: Option<String>,
) -> Result<serde_json::Value, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(format!("源路径不存在: {}", source_path));
    }

    let is_local = scope.as_deref() == Some("local");
    let target_dir = if is_local {
        local_skills_dir(cwd.as_deref().unwrap_or("."))
            .ok_or("无法获取本地 skills 目录")?
    } else {
        global_skills_dir().ok_or("无法获取全局 skills 目录")?
    };

    let name = source
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".into());

    if !is_safe_skill_name(&name) {
        return Err(format!("无效的 Skill 名称: {}", name));
    }

    let target = target_dir.join(&name);
    if target.exists() {
        return Err(serde_json::json!({
            "success": false,
            "error": format!("已存在同名 Skill: {}", name),
        }).to_string());
    }

    ensure_dir(&target_dir)?;

    // 复制文件/目录
    if source.is_dir() {
        copy_dir_recursive(&source, &target)
            .map_err(|e| format!("复制目录失败: {}", e))?;
    } else {
        fs::copy(&source, &target).map_err(|e| format!("复制文件失败: {}", e))?;
    }

    let metadata = parse_skill_metadata(&target);

    Ok(serde_json::json!({
        "success": true,
        "name": name,
        "type": if source.is_dir() { "directory" } else { "file" },
        "scope": scope.as_deref().unwrap_or("global"),
        "path": target.to_string_lossy().to_string(),
        "description": metadata.as_ref().map(|m| m.description.as_str()).unwrap_or(""),
        "enabled": true,
    }))
}

// ─── 获取 Skill 元数据 ────────────────────────────────────────────────────

/// 读取 SKILL.md 的 frontmatter 元数据
#[tauri::command]
pub async fn cc_get_skill_metadata(skill_path: String) -> Result<Option<SkillMetadata>, String> {
    let path = PathBuf::from(&skill_path);
    if path.is_dir() {
        Ok(parse_skill_metadata(&path))
    } else if let Some(parent) = path.parent() {
        Ok(parse_skill_metadata(parent))
    } else {
        Ok(None)
    }
}

// ─── 内部工具函数 ────────────────────────────────────────────────────────────

/// 根据 scope/enabled 获取 skill 目录
fn get_skill_dir(
    name: &str,
    scope: Option<&str>,
    enabled: bool,
    cwd: Option<&str>,
) -> Result<PathBuf, String> {
    let is_local = scope == Some("local");

    if enabled {
        if is_local {
            local_skills_dir(cwd.unwrap_or(".")).ok_or("无法获取本地 skills 目录".into())
        } else {
            global_skills_dir().ok_or("无法获取全局 skills 目录".into())
        }
    } else {
        if is_local {
            local_management_dir(cwd.unwrap_or(".")).ok_or("无法获取本地管理目录".into())
        } else {
            global_management_dir().ok_or("无法获取全局管理目录".into())
        }
    }
    .map(|d| d.join(name))
}

/// 递归复制目录
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), std::io::Error> {
    fs::create_dir_all(dst)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
    fs::copy(&src_path, &dst_path)?;
        }
    }

    Ok(())
}

// ─── B7: 条件Skill过滤 ─────────────────────────────────────────────────────────

/// 根据上下文过滤 Skill：仅返回匹配当前文件类型/语言的 Skill
#[tauri::command]
pub async fn cc_filter_skills_by_context(
    file_path: Option<String>,
    language: Option<String>,
) -> Result<Vec<SkillEntry>, String> {
    let cwd = std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| ".".to_string());

    // 获取所有 skills
    let mut all: Vec<SkillEntry> = Vec::new();
    if let Some(gd) = global_skills_dir() {
        all.extend(scan_skills_directory(&gd, "global", true).skills);
    }
    if let Some(local) = local_skills_dir(&cwd) {
        let local_skills = scan_skills_directory(&local, "project", true).skills;
        all.extend(local_skills);
    }

    // 去重
    let mut seen = std::collections::HashSet::new();
    all.retain(|s| seen.insert(s.name.clone()));

    // 无过滤 → 返回全部
    if file_path.is_none() && language.is_none() {
        return Ok(all);
    }

    // 推断上下文
    let ext = file_path.as_ref().and_then(|fp| {
        std::path::Path::new(fp).extension()
            .map(|e| e.to_string_lossy().to_lowercase())
    });
    let lang = language.as_ref().map(|l| l.to_lowercase());
    let lang_from_ext = match ext.as_deref() {
        Some("rs") => Some("rust".to_string()),
        Some("ts" | "tsx") => Some("typescript".to_string()),
        Some("js" | "jsx") => Some("javascript".to_string()),
        Some("py") => Some("python".to_string()),
        Some("java") => Some("java".to_string()),
        Some("go") => Some("go".to_string()),
        _ => None,
    };
    let effective_lang = lang.or(lang_from_ext);

    let filtered: Vec<SkillEntry> = all.into_iter()
        .filter(|s| {
            if let Some(ref l) = effective_lang {
                s.name.to_lowercase().contains(l) ||
                s.description.to_lowercase().contains(l)
            } else { true }
        })
        .collect();

    Ok(filtered)
}
