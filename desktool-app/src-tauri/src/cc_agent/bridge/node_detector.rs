// bridge/node_detector.rs — B6-2: 智能Node.js检测
// 对齐 cc-gui NodeDetector.java: 多路径扫描 + 版本检查
// 搜索 nvm、brew、系统路径中的 Node.js

use std::path::PathBuf;
use std::process::Command;

/// Node 检测结果
#[derive(Debug, Clone, serde::Serialize)]
pub struct NodeDetection {
    pub found: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub npm_version: Option<String>,
    pub source: Option<String>,     // "system" | "nvm" | "brew" | "fnm" | "volta" | "custom"
    pub candidates: Vec<PathCandidate>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct PathCandidate {
    pub path: String,
    pub version: Option<String>,
    pub source: String,
}

/// 检测系统中可用的 Node.js 安装
#[tauri::command]
pub async fn cc_detect_node_installations() -> Result<NodeDetection, String> {
    let mut candidates = Vec::new();

    // 1. 检查 PATH 中的 node
    if let Ok(output) = Command::new("which").arg("node").output() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            let version = get_node_version(&path);
            candidates.push(PathCandidate {
                path: path.clone(),
                version: version.clone(),
                source: "system".into(),
            });
        }
    }

    // 2. 检查 nvm
    let home = std::env::var("HOME").unwrap_or_default();
    let nvm_dir = PathBuf::from(&home).join(".nvm").join("versions").join("node");
    if nvm_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
            for entry in entries.flatten() {
                let ver_dir = entry.path();
                if ver_dir.is_dir() {
                    let node_bin = ver_dir.join("bin").join("node");
                    if node_bin.exists() {
                        let path = node_bin.to_string_lossy().to_string();
                        let version = get_node_version(&path);
                        candidates.push(PathCandidate {
                            path,
                            version,
                            source: "nvm".into(),
                        });
                    }
                }
            }
        }
    }

    // 3. 检查 fnm
    let fnm_dir = PathBuf::from(&home).join(".fnm").join("node-versions");
    if fnm_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&fnm_dir) {
            for entry in entries.flatten() {
                let ver_dir = entry.path();
                if ver_dir.is_dir() {
                    let node_bin = ver_dir.join("installation").join("bin").join("node");
                    if node_bin.exists() {
                        let path = node_bin.to_string_lossy().to_string();
                        let version = get_node_version(&path);
                        candidates.push(PathCandidate {
                            path,
                            version,
                            source: "fnm".into(),
                        });
                    }
                }
            }
        }
    }

    // 4. 检查 brew (macOS)
    if let Ok(output) = Command::new("brew").args(["--prefix", "node"]).output() {
        let brew_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !brew_path.is_empty() {
            let node_bin = PathBuf::from(&brew_path).join("bin").join("node");
            if node_bin.exists() {
                let path = node_bin.to_string_lossy().to_string();
                let version = get_node_version(&path);
                if !candidates.iter().any(|c: &PathCandidate| c.path == path) {
                    candidates.push(PathCandidate {
                        path,
                        version,
                        source: "brew".into(),
                    });
                }
            }
        }
    }

    // 5. 检查 volta
    let volta_dir = PathBuf::from(&home).join(".volta").join("bin");
    if volta_dir.exists() {
        let node_bin = volta_dir.join("node");
        if node_bin.exists() {
            let path = node_bin.to_string_lossy().to_string();
            let version = get_node_version(&path);
            if !candidates.iter().any(|c: &PathCandidate| c.path == path) {
                candidates.push(PathCandidate {
                    path,
                    version,
                    source: "volta".into(),
                });
            }
        }
    }

    // 去重：按路径
    let mut seen = std::collections::HashSet::new();
    candidates.retain(|c| seen.insert(c.path.clone()));

    // 查找最佳候选
    let best = candidates.first().cloned();

    let mut npm_ver = None;
    if let Some(ref best_path) = best.as_ref().map(|c| c.path.clone()) {
        npm_ver = get_npm_version(best_path);
    }

    Ok(NodeDetection {
        found: !candidates.is_empty(),
        path: best.as_ref().map(|c| c.path.clone()),
        version: best.as_ref().and_then(|c| c.version.clone()),
        npm_version: npm_ver,
        source: best.as_ref().map(|c| c.source.clone()),
        candidates,
    })
}

fn get_node_version(bin_path: &str) -> Option<String> {
    Command::new(bin_path)
        .arg("--version")
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().replace('v', "").to_string())
}

fn get_npm_version(node_path: &str) -> Option<String> {
    let npm_path = PathBuf::from(node_path)
        .parent()
        .map(|p| p.join("npm"))
        .unwrap_or_else(|| PathBuf::from("npm"));

    let npm = if npm_path.exists() {
        npm_path.to_string_lossy().to_string()
    } else {
        "npm".to_string()
    };

    Command::new(&npm)
        .arg("--version")
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}
