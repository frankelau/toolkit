// dependency.rs — 引擎与依赖检查
// Sprint L: 从 cc_agent.rs 拆分

use serde::Serialize;
use super::bridge::bridge_script_path;
use super::types::DependencyInfo;

/// Check if claude/codex CLI and bridge SDKs are available
#[tauri::command]
pub async fn cc_check_engines() -> Result<serde_json::Value, String> {
    let claude = which_bin("claude");
    let codex = which_bin("codex");
    let bridge = std::path::Path::new(&bridge_script_path()).exists();

    let bridge_dir_path = super::bridge::bridge_dir();
    let claude_sdk = std::path::Path::new(&format!(
        "{}/node_modules/@anthropic-ai/claude-agent-sdk",
        bridge_dir_path
    )).exists();
    let codex_sdk = std::path::Path::new(&format!(
        "{}/node_modules/@openai/codex-sdk",
        bridge_dir_path
    )).exists();

    Ok(serde_json::json!({
        "claude": claude,
        "codex": codex,
        "bridge": bridge,
        "claudeSdk": claude_sdk,
        "codexSdk": codex_sdk,
    }))
}

fn which_bin(name: &str) -> Option<serde_json::Value> {
    // Use the `which` crate for cross-platform PATH lookup
    let exe_name = if cfg!(target_os = "windows") {
        format!("{}.cmd", name) // npm CLIs on Windows are .cmd wrappers
    } else {
        name.to_string()
    };

    // Try PATH lookup via `which` crate first
    if let Ok(path) = which::which(&exe_name).or_else(|_| which::which(name)) {
        let path_str = path.to_string_lossy().to_string();
        let version = std::process::Command::new(&path_str)
            .arg("--version")
            .output()
            .ok()
            .and_then(|o| if o.status.success() {
                Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
            } else { None })
            .unwrap_or_default();
        return Some(serde_json::json!({ "path": path_str, "version": version }));
    }

    // Fallback: check platform-specific install locations
    let fallbacks: Vec<String> = if cfg!(target_os = "windows") {
        std::env::var("APPDATA")
            .map(|p| vec![format!("{}\\npm\\{}.cmd", p, name)])
            .unwrap_or_default()
    } else {
        vec![
            format!("/usr/local/bin/{}", name),
            format!("/opt/homebrew/bin/{}", name),
        ]
    };

    for c in &fallbacks {
        if std::path::Path::new(c).exists() {
            let version = std::process::Command::new(c)
                .arg("--version")
                .output()
                .ok()
                .and_then(|o| if o.status.success() {
                    Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
                } else { None })
                .unwrap_or_default();
            return Some(serde_json::json!({ "path": c, "version": version }));
        }
    }
    None
}

/// 全面依赖检查
#[tauri::command]
pub async fn cc_check_dependencies() -> Result<Vec<DependencyInfo>, String> {
    let deps = vec![
        ("claude", vec!["--version"]),
        ("codex", vec!["--version"]),
        ("git", vec!["--version"]),
        ("node", vec!["--version"]),
        ("python3", vec!["--version"]),
        ("rg", vec!["--version"]),
        ("fd", vec!["--version"]),
    ];
    let mut results = Vec::new();
    for (name, args) in deps {
        let output = tokio::process::Command::new(name)
            .args(&args)
            .output()
            .await;
        let info = match output {
            Ok(o) if o.status.success() => {
                let stdout = String::from_utf8_lossy(&o.stdout).trim().to_string();
                let version = stdout.lines().next().map(|s| s.to_string());
                let path = which::which(name).ok().map(|p| p.to_string_lossy().to_string());
                DependencyInfo { name: name.to_string(), path, version, installed: true }
            }
            _ => DependencyInfo {
                name: name.to_string(),
                path: which::which(name).ok().map(|p| p.to_string_lossy().to_string()),
                version: None,
                installed: false,
            },
        };
        results.push(info);
    }
    Ok(results)
}
