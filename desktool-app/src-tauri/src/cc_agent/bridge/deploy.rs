// bridge.rs — Node.js bridge 通信与部署
// Sprint L: 从 cc_agent.rs 拆分

use tauri::{AppHandle, Emitter};

/// Resolve the node binary path
pub fn node_bin() -> String {
    // Use `which` crate for cross-platform lookup
    if let Ok(p) = which::which("node") {
        return p.to_string_lossy().to_string();
    }
    // macOS fallbacks
    #[cfg(target_os = "macos")]
    for c in &["/usr/local/bin/node", "/opt/homebrew/bin/node"] {
        if std::path::Path::new(c).exists() {
            return c.to_string();
        }
    }
    "node".to_string()
}

/// Path to deployed bridge directory
pub fn bridge_dir() -> String {
    // Windows uses USERPROFILE; Unix uses HOME
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| std::env::temp_dir().to_string_lossy().to_string());
    if cfg!(target_os = "windows") {
        format!("{}\\.desktool\\cc-bridge", home)
    } else {
        format!("{}/.desktool/cc-bridge", home)
    }
}

/// Path to the bridge script
pub fn bridge_script_path() -> String {
    format!("{}/bridge.mjs", bridge_dir())
}

/// Ensure the bridge is deployed to ~/.desktool/cc-bridge/
/// If missing or stale, copies from bundled resources and runs npm install.
pub async fn ensure_bridge(app: &AppHandle) -> Result<(), String> {
    use tauri::Manager;

    let dest_dir = bridge_dir();
    let bridge_path = bridge_script_path();
    let sdk_path = format!("{}/node_modules/@anthropic-ai/claude-agent-sdk", dest_dir);

    // Only skip if both bridge.mjs AND SDK node_modules exist
    if std::path::Path::new(&bridge_path).exists()
        && std::path::Path::new(&sdk_path).exists()
    {
        return Ok(());
    }

    // Find bundled cc-bridge resource directory
    let resource_path = app.path()
        .resource_dir()
        .map_err(|e| format!("Cannot locate resource dir: {}", e))?
        .join("cc-bridge");

    if !resource_path.exists() {
        // Fallback: try to use existing ~/.desktool location if present
        return if std::path::Path::new(&bridge_path).exists() {
            Ok(())
        } else {
            Err(format!("Bridge not found. Expected resources at {:?}", resource_path))
        };
    }

    // Create dest dir
    std::fs::create_dir_all(&dest_dir)
        .map_err(|e| format!("Cannot create bridge dir {}: {}", dest_dir, e))?;

    // Copy all bridge files (excluding node_modules)
    copy_dir_recursive(&resource_path, std::path::Path::new(&dest_dir), &["node_modules"])
        .map_err(|e| format!("Failed to copy bridge files: {}", e))?;

    // Run npm install
    let _ = app.emit("cc_bridge_status", serde_json::json!({"status":"installing","message":"正在安装 cc-bridge 依赖..."}));

    let node = node_bin();
    let npm = find_npm(&node);

    let status = std::process::Command::new(&npm)
        .arg("install")
        .arg("--prefer-offline")
        .arg("--no-audit")
        .current_dir(&dest_dir)
        .status()
        .map_err(|e| format!("npm install failed to start: {}", e))?;

    if !status.success() {
        return Err(format!("npm install failed in {}. Please run manually: cd {} && npm install", dest_dir, dest_dir));
    }

    let _ = app.emit("cc_bridge_status", serde_json::json!({"status":"ready","message":"cc-bridge 就绪"}));
    Ok(())
}

pub fn find_npm(node_bin: &str) -> String {
    // On Windows npm is npm.cmd; on Unix it's npm
    let npm_name = if cfg!(target_os = "windows") { "npm.cmd" } else { "npm" };

    // Look beside the node binary first
    let node_path = std::path::Path::new(node_bin);
    if let Some(parent) = node_path.parent() {
        let npm = parent.join(npm_name);
        if npm.exists() {
            return npm.to_string_lossy().to_string();
        }
        // Windows: also try plain npm.cmd in same dir
        #[cfg(target_os = "windows")]
        {
            let npm_cmd = parent.join("npm.cmd");
            if npm_cmd.exists() {
                return npm_cmd.to_string_lossy().to_string();
            }
        }
    }

    // Fall back to PATH lookup
    if let Ok(p) = which::which(npm_name) {
        return p.to_string_lossy().to_string();
    }

    npm_name.to_string()
}

pub fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path, skip: &[&str]) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().to_string();
        if skip.contains(&name.as_str()) {
            continue;
        }
        let src_path = entry.path();
        let dst_path = dst.join(&name);
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path, skip)?;
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

/// Manually trigger bridge deployment (used by frontend on first run)
#[tauri::command]
pub async fn cc_ensure_bridge(app: AppHandle) -> Result<serde_json::Value, String> {
    match ensure_bridge(&app).await {
        Ok(()) => Ok(serde_json::json!({"success": true})),
        Err(e) => Ok(serde_json::json!({"success": false, "error": e})),
    }
}

// ─── B7: Bridge归档解压/验证 ────────────────────────────────────────────────────

use std::fs;
use std::io::Read;

/// 验证 bridge 目录完整性（检查关键文件）
#[tauri::command]
pub async fn cc_verify_bridge_integrity() -> Result<serde_json::Value, String> {
    let bd = std::path::PathBuf::from(bridge_dir());
    let required_files = vec![
        "package.json",
        "index.js",
        "node_modules",
    ];

    let mut missing = Vec::new();
    let mut sizes = serde_json::Map::new();

    for file in &required_files {
        let path = bd.join(file);
        if !path.exists() {
            missing.push(file.to_string());
        } else if path.is_file() {
            if let Ok(meta) = fs::metadata(&path) {
                sizes.insert(file.to_string(), serde_json::json!(meta.len()));
            }
        } else {
            sizes.insert(file.to_string(), serde_json::json!("dir"));
        }
    }

    Ok(serde_json::json!({
        "valid": missing.is_empty(),
        "bridge_dir": bd.to_string_lossy(),
        "missing_files": missing,
        "file_sizes": sizes,
    }))
}

/// 从源码复制 bridge 文件 (替代从jar解压)
#[tauri::command]
pub async fn cc_extract_bridge(
    force: Option<bool>,
) -> Result<serde_json::Value, String> {
    let bd = std::path::PathBuf::from(bridge_dir());
    let is_force = force.unwrap_or(false);

    if bd.join("node_modules").is_dir() && !is_force {
        return Ok(serde_json::json!({
            "extracted": false,
            "message": "Bridge 已安装，使用 force=true 强制重装",
            "bridge_dir": bd.to_string_lossy(),
        }));
    }

    // 创建目录
    fs::create_dir_all(&bd).map_err(|e| format!("创建目录失败: {}", e))?;

    // 写入 package.json (最小依赖)
    let package_json = serde_json::json!({
        "name": "desktool-bridge",
        "version": "1.0.0",
        "private": true,
        "main": "index.js",
        "type": "module",
        "dependencies": {}
    });
    fs::write(
        bd.join("package.json"),
        serde_json::to_string_pretty(&package_json).unwrap_or_default(),
    ).map_err(|e| format!("写入 package.json 失败: {}", e))?;

    // 写入 index.js
    let index_js = r#"// DeskTool Bridge — Node.js side
import { stdin, stdout } from 'process';
import { createInterface } from 'readline';

const rl = createInterface({ input: stdin });

// NDJSON protocol
rl.on('line', (line) => {
    try {
        const msg = JSON.parse(line);
        const response = handleMessage(msg);
        stdout.write(JSON.stringify(response) + '\n');
    } catch (e) {
        stdout.write(JSON.stringify({ type: 'error', error: String(e) }) + '\n');
    }
});

function handleMessage(msg) {
    switch (msg.method) {
        case 'ping': return { type: 'pong' };
        case 'eval': return { type: 'result', value: eval(msg.code) };
        case 'command':
            try {
                const result = eval(msg.expression);
                return { type: 'result', value: result };
            } catch (e) {
                return { type: 'error', error: String(e) };
            }
        default: return { type: 'error', error: 'Unknown method: ' + msg.method };
    }
}

stdout.write(JSON.stringify({ type: 'ready' }) + '\n');
"#;
    fs::write(bd.join("index.js"), index_js)
        .map_err(|e| format!("写入 index.js 失败: {}", e))?;

    Ok(serde_json::json!({
        "extracted": true,
        "bridge_dir": bd.to_string_lossy(),
        "files_written": ["package.json", "index.js"],
    }))
}
