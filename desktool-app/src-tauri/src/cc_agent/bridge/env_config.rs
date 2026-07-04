// bridge/env_config.rs — B6-2: Bridge运行环境配置
// 对齐 cc-gui EnvironmentConfigurator.java
// 检查/配置 Bridge 运行所需的环境变量 (PATH, Node, npm)

use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;

/// 环境配置结果
#[derive(Debug, Clone, serde::Serialize)]
pub struct EnvConfig {
    pub ok: bool,
    pub node_available: bool,
    pub npm_available: bool,
    pub home_dir: String,
    pub path_entries: Vec<String>,
    pub issues: Vec<String>,
    pub suggestions: Vec<String>,
}

/// 检查 PATH 中是否包含某目录
fn path_contains(dir: &str) -> bool {
    let sep = if cfg!(target_os = "windows") { ';' } else { ':' };
    let trail = if cfg!(target_os = "windows") { '\\' } else { '/' };
    std::env::var("PATH")
        .unwrap_or_default()
        .split(sep)
        .any(|p| p.trim_end_matches(trail) == dir.trim_end_matches(trail))
}

/// 获取 npm 全局 bin 目录
fn npm_global_bin() -> Option<String> {
    Command::new("npm")
        .args(["config", "get", "prefix"])
        .output()
        .ok()
        .map(|o| {
            let prefix = String::from_utf8_lossy(&o.stdout).trim().to_string();
            PathBuf::from(&prefix).join("bin").to_string_lossy().to_string()
        })
}

/// 检查并配置 Bridge 运行环境
#[tauri::command]
pub async fn cc_configure_bridge_env() -> Result<EnvConfig, String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let mut issues = Vec::new();
    let mut suggestions = Vec::new();
    let mut path_entries = Vec::new();

    // 1. 收集 PATH 条目
    let path_sep = if cfg!(target_os = "windows") { ';' } else { ':' };
    if let Ok(path) = std::env::var("PATH") {
        path_entries = path.split(path_sep).map(|s| s.to_string()).collect();
    }

    // 2. 检查 Node.js
    let node_cmd = if cfg!(target_os = "windows") { "node.exe" } else { "node" };
    let node_available = Command::new(node_cmd)
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !node_available {
        issues.push("Node.js 未安装或不在 PATH 中".to_string());
        suggestions.push("安装 Node.js: https://nodejs.org".to_string());
        if !cfg!(target_os = "windows") {
            suggestions.push("或使用 nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash".to_string());
        }
    }

    // 3. 检查 npm
    let npm_cmd = if cfg!(target_os = "windows") { "npm.cmd" } else { "npm" };
    let npm_available = Command::new(npm_cmd)
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !npm_available {
        issues.push("npm 不可用".to_string());
        suggestions.push("npm 随 Node.js 一起安装，请重新安装 Node.js".to_string());
    }

    // 4. 检查常用目录是否在 PATH
    let common_paths = vec![
        format!("{}/.npm-global/bin", home),
        format!("{}/.local/bin", home),
        format!("{}/.nvm/current/bin", home),
        "/usr/local/bin".to_string(),
        "/opt/homebrew/bin".to_string(),
    ];

    for p in &common_paths {
        if PathBuf::from(p).exists() && !path_contains(p) {
            suggestions.push(format!("建议将 {} 加入 PATH", p));
        }
    }

    // 5. 检查 npm 全局 bin
    if let Some(npm_bin) = npm_global_bin() {
        if !path_contains(&npm_bin) {
            suggestions.push(format!("建议将 npm全局目录 加入 PATH: {}", npm_bin));
        }
    }

    // 6. 检查常用工具
    let tools = vec!["git", "curl", "make"];
    let mut tool_checks = HashMap::new();
    for tool in &tools {
        let ok = Command::new(tool).arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        tool_checks.insert(tool.to_string(), ok);
        if !ok {
            issues.push(format!("{} 未安装", tool));
        }
    }

    Ok(EnvConfig {
        ok: node_available && npm_available && issues.is_empty(),
        node_available,
        npm_available,
        home_dir: home,
        path_entries,
        issues,
        suggestions,
    })
}
