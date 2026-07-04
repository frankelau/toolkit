// skill/commands.rs — B6-1: 斜杠命令扫描
// 对齐 cc-gui SlashCommandRegistry + PluginCommandScanner
// 扫描 ~/.claude/commands/ + {workspace}/.claude/commands/ 目录

use std::fs;
use std::path::PathBuf;

/// 斜杠命令条目
#[derive(Debug, Clone, serde::Serialize)]
pub struct SlashCommand {
    pub name: String,
    pub description: String,
    pub source: String,       // "bundled" | "global" | "project" | "plugin"
    pub prompt: Option<String>,
}

/// 内置斜杠命令（对齐 cc-gui SlashCommandRegistry）
fn builtin_commands() -> Vec<SlashCommand> {
    vec![
        SlashCommand { name: "/init".into(), description: "Initialize a new CLAUDE.md file".into(), source: "bundled".into(), prompt: None },
        SlashCommand { name: "/compact".into(), description: "Compact conversation context".into(), source: "bundled".into(), prompt: None },
        SlashCommand { name: "/clear".into(), description: "Clear conversation history".into(), source: "bundled".into(), prompt: None },
        SlashCommand { name: "/context".into(), description: "Show current context usage".into(), source: "bundled".into(), prompt: None },
        SlashCommand { name: "/cost".into(), description: "Show token usage and cost".into(), source: "bundled".into(), prompt: None },
        SlashCommand { name: "/doctor".into(), description: "Check system health".into(), source: "bundled".into(), prompt: None },
        SlashCommand { name: "/status".into(), description: "Show current session status".into(), source: "bundled".into(), prompt: None },
        SlashCommand { name: "/pr-comments".into(), description: "Review PR comments".into(), source: "bundled".into(), prompt: None },
        SlashCommand { name: "/release-notes".into(), description: "Generate release notes".into(), source: "bundled".into(), prompt: None },
        SlashCommand { name: "/review".into(), description: "Code review current changes".into(), source: "bundled".into(), prompt: None },
        SlashCommand { name: "/loop".into(), description: "Run a prompt on recurring interval".into(), source: "bundled".into(), prompt: None },
    ]
}

/// 解析 Markdown frontmatter 中的 description
fn parse_md_frontmatter(content: &str) -> (String, String) {
    let mut description = String::new();
    let mut prompt = String::new();
    let mut in_frontmatter = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == "---" {
            if !in_frontmatter {
                in_frontmatter = true;
                continue;
            } else {
                break;
            }
        }
        if in_frontmatter {
            if let Some(value) = trimmed.strip_prefix("description:") {
                description = value.trim().trim_matches('"').trim_matches('\'').to_string();
            } else if let Some(value) = trimmed.strip_prefix("prompt:") {
                prompt = value.trim().trim_matches('"').trim_matches('\'').to_string();
            }
        }
    }

    (description, prompt)
}

/// 扫描 commands 目录
fn scan_commands_dir(dir: &PathBuf, source: &str) -> Vec<SlashCommand> {
    let mut commands = Vec::new();
    if !dir.exists() || !dir.is_dir() {
        return commands;
    }

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_stem()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            if name.is_empty() { continue; }

            let cmd_name = if name.starts_with('/') {
                name.clone()
            } else {
                format!("/{}", name)
            };

            let (description, prompt) = if let Ok(content) = fs::read_to_string(&path) {
                let (d, p) = parse_md_frontmatter(&content);
                let prompt_opt = if p.is_empty() { None } else { Some(p) };
                (d, prompt_opt)
            } else {
                (String::new(), None)
            };

            let desc = if description.is_empty() {
                format!("Custom command: {}", cmd_name)
            } else {
                description
            };

            if !commands.iter().any(|c: &SlashCommand| c.name == cmd_name) {
                commands.push(SlashCommand {
                    name: cmd_name,
                    description: desc,
                    source: source.to_string(),
                    prompt: prompt.clone(),
                });
            }
        }
    }

    commands
}

/// 列出所有可用的斜杠命令
#[tauri::command]
pub async fn cc_list_slash_commands(
    workspace: Option<String>,
) -> Result<Vec<SlashCommand>, String> {
    let mut commands = builtin_commands();

    // 扫描全局 commands
    let home = std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/tmp"));
    let global_dir = home.join(".claude").join("commands");
    for cmd in scan_commands_dir(&global_dir, "global") {
        commands.push(cmd);
    }

    // 扫描项目级 commands
    if let Some(cwd) = workspace {
        let project_dir = PathBuf::from(&cwd).join(".claude").join("commands");
        for cmd in scan_commands_dir(&project_dir, "project") {
            // 如果名字和全局命令冲突，项目级覆盖
            if let Some(existing) = commands.iter_mut().find(|c| c.name == cmd.name && c.source != "project") {
                *existing = cmd;
            } else {
                commands.push(cmd);
            }
        }
    }

    Ok(commands)
}
