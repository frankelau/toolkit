/**
 * SwitchHosts —— 读写 /etc/hosts，管理分组条目
 *
 * 分组数据（HostGroup）持久化在前端 localStorage，此处只负责：
 *   - read_hosts()    → 读取系统原有条目（DevKit 区段外）
 *   - apply_hosts()   → 把 groups 写入 /etc/hosts 的 DevKit 区段
 *   - preview_hosts() → 返回预览字符串
 *
 * DevKit 区段格式：
 *   # === DevKit hosts begin ===
 *   # [Group: 本地开发] enabled
 *   127.0.0.1 api.local.com
 *   # 旧条目（手动注释）
 *   # [Group: 测试] disabled
 *   # 192.168.1.100 api.test.com    ← disabled 时整组自动加 # 前缀
 *   # === DevKit hosts end ===
 */
use serde::{Deserialize, Serialize};
use std::fs;

const HOSTS_PATH: &str = "/etc/hosts";
const BEGIN_MARKER: &str = "# === DevKit hosts begin ===";
const END_MARKER: &str = "# === DevKit hosts end ===";

// ── 数据模型 ──────────────────────────────────────────────────────────────────

/// 分组使用自由文本 content（支持注释行、空行），由前端持久化
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostGroup {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    /// 自由文本，每行可以是 "IP hostname"、注释（#...）或空行
    pub content: String,
    /// 系统分组标记：不可删除，内容写入 /etc/hosts 系统区域（DevKit 区段外）
    #[serde(default)]
    pub is_system: bool,
}

// ── 序列化：groups → hosts 区段文本 ──────────────────────────────────────────

fn groups_to_section(groups: &[HostGroup]) -> String {
    let mut lines = vec![BEGIN_MARKER.to_string()];
    for g in groups {
        let status = if g.enabled { "enabled" } else { "disabled" };
        lines.push(format!("# [Group: {}] {}", g.name, status));
        for raw in g.content.lines() {
            if g.enabled {
                // 启用：原样输出（保留用户手写的注释）
                lines.push(raw.to_string());
            } else {
                // 禁用：空行原样，非空行加 # 前缀（如已是注释则保持）
                if raw.trim().is_empty() {
                    lines.push(raw.to_string());
                } else if raw.trim_start().starts_with('#') {
                    lines.push(raw.to_string());
                } else {
                    lines.push(format!("# {}", raw));
                }
            }
        }
    }
    lines.push(END_MARKER.to_string());
    lines.join("\n")
}

// ── 读 /etc/hosts，仅返回 DevKit 区段外的原有内容 ────────────────────────────

#[derive(Debug, Serialize)]
pub struct HostsInfo {
    pub system_lines: Vec<String>,
}

#[tauri::command]
pub fn read_hosts() -> Result<HostsInfo, String> {
    let content = fs::read_to_string(HOSTS_PATH)
        .map_err(|e| format!("读取 {} 失败：{}", HOSTS_PATH, e))?;

    let mut in_section = false;
    let mut system_lines: Vec<String> = Vec::new();

    for line in content.lines() {
        if line.trim() == BEGIN_MARKER { in_section = true; continue; }
        if line.trim() == END_MARKER   { in_section = false; continue; }
        if !in_section { system_lines.push(line.to_string()); }
    }

    Ok(HostsInfo { system_lines })
}

// ── 写回 /etc/hosts（需要提权）──────────────────────────────────────────────

fn build_new_hosts(groups: &[HostGroup]) -> Result<String, String> {
    let content = fs::read_to_string(HOSTS_PATH)
        .map_err(|e| format!("读取 {} 失败：{}", HOSTS_PATH, e))?;

    // 分离系统分组和用户分组
    let system_groups: Vec<&HostGroup> = groups.iter().filter(|g| g.is_system).collect();
    let user_groups: Vec<HostGroup> = groups.iter().filter(|g| !g.is_system).cloned().collect();

    // 收集原有系统区域内容（DevKit 区段外的行），排除已有系统分组内容
    let mut original_system_lines: Vec<String> = Vec::new();
    let mut in_section = false;
    for line in content.lines() {
        if line.trim() == BEGIN_MARKER { in_section = true; continue; }
        if line.trim() == END_MARKER   { in_section = false; continue; }
        if !in_section { original_system_lines.push(line.to_string()); }
    }

    let mut out_lines: Vec<String> = Vec::new();

    // 1. 写入系统分组内容（替换原有系统区域）
    if !system_groups.is_empty() {
        for g in &system_groups {
            // 系统分组即使 disabled 也原样写入（它是系统原有内容）
            for raw in g.content.lines() {
                out_lines.push(raw.to_string());
            }
        }
    } else {
        // 没有系统分组，保留原有系统区域内容
        out_lines.extend(original_system_lines);
    }

    // 去掉尾部空行
    while out_lines.last().map(|l: &String| l.trim().is_empty()).unwrap_or(false) {
        out_lines.pop();
    }

    out_lines.push(String::new());
    out_lines.push(groups_to_section(&user_groups));
    out_lines.push(String::new());

    Ok(out_lines.join("\n"))
}

#[tauri::command]
pub fn apply_hosts(groups: Vec<HostGroup>) -> Result<(), String> {
    let new_content = build_new_hosts(&groups)?;
    let tmp = format!("/tmp/devkit_hosts_{}", uuid::Uuid::new_v4());
    fs::write(&tmp, &new_content).map_err(|e| format!("写临时文件失败：{}", e))?;

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "do shell script \"cp '{}' /etc/hosts\" with administrator privileges",
            tmp
        );
        let out = std::process::Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| format!("osascript 失败：{}", e))?;
        let _ = fs::remove_file(&tmp);
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr);
            return Err(format!("写入 /etc/hosts 失败：{}", stderr));
        }
    }

    #[cfg(all(target_os = "linux", not(target_os = "macos")))]
    {
        let out = std::process::Command::new("pkexec")
            .args(["cp", &tmp, "/etc/hosts"])
            .output()
            .map_err(|e| format!("pkexec 失败：{}", e))?;
        let _ = fs::remove_file(&tmp);
        if !out.status.success() {
            return Err("写入 /etc/hosts 失败，请确认已授权".into());
        }
    }

    #[cfg(target_os = "windows")]
    {
        let _ = fs::remove_file(&tmp);
        return Err("Windows 暂不支持直接写 hosts".into());
    }

    Ok(())
}

#[tauri::command]
pub fn preview_hosts(groups: Vec<HostGroup>) -> Result<String, String> {
    build_new_hosts(&groups)
}

/// 读取系统 /etc/hosts 中 DevKit 区段外的内容，返回为字符串
/// 用于初始化「系统 hosts」分组
#[tauri::command]
pub fn read_system_hosts() -> Result<String, String> {
    let content = fs::read_to_string(HOSTS_PATH)
        .map_err(|e| format!("读取 {} 失败：{}", HOSTS_PATH, e))?;

    let mut in_section = false;
    let mut lines: Vec<String> = Vec::new();

    for line in content.lines() {
        if line.trim() == BEGIN_MARKER { in_section = true; continue; }
        if line.trim() == END_MARKER   { in_section = false; continue; }
        if !in_section { lines.push(line.to_string()); }
    }

    // 去掉尾部空行
    while lines.last().map(|l: &String| l.trim().is_empty()).unwrap_or(false) {
        lines.pop();
    }

    Ok(lines.join("\n"))
}
