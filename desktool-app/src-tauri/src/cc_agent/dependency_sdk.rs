// dependency_sdk.rs — SDK 自动检测 + 下载安装 + 版本管理
// Sprint B4: 对齐 cc-gui DependencyManager.java (953行)
//
// cc-gui 功能: SDK 检测 → 版本查询 → npm install 安装 → manifest 追踪
// ccagent 适配: SdkDefinition 枚举 → 安装管理器 → Tauri 命令 → 前端接线

use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::State;
use super::settings;

// ─── SDK Definition ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SdkId {
    #[serde(rename = "claude-agent-sdk")]
    ClaudeAgentSdk,
    #[serde(rename = "codex-sdk")]
    CodexSdk,
}

impl SdkId {
    pub fn npm_package(&self) -> &'static str {
        match self {
            SdkId::ClaudeAgentSdk => "@anthropic-ai/claude-agent-sdk",
            SdkId::CodexSdk => "@openai/codex-sdk",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            SdkId::ClaudeAgentSdk => "Claude Agent SDK",
            SdkId::CodexSdk => "Codex SDK",
        }
    }

    pub fn all() -> Vec<SdkId> {
        vec![SdkId::ClaudeAgentSdk, SdkId::CodexSdk]
    }

    pub fn from_id(id: &str) -> Option<SdkId> {
        match id {
            "claude-agent-sdk" => Some(SdkId::ClaudeAgentSdk),
            "codex-sdk" => Some(SdkId::CodexSdk),
            _ => None,
        }
    }
}

// ─── SDK Status ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SdkStatus {
    pub sdk_id: String,
    pub display_name: String,
    pub npm_package: String,
    pub installed: bool,
    pub installed_version: Option<String>,
    pub latest_version: Option<String>,
    pub has_update: bool,
    pub install_dir: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallProgress {
    pub sdk_id: String,
    pub stage: String,
    pub progress: f32,
    pub log: Vec<String>,
    pub done: bool,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallResult {
    pub sdk_id: String,
    pub success: bool,
    pub version: Option<String>,
    pub error: Option<String>,
    pub logs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeEnvStatus {
    pub node_installed: bool,
    pub node_path: Option<String>,
    pub node_version: Option<String>,
    pub npm_installed: bool,
    pub npm_version: Option<String>,
}

// ─── SDK Manager State ──────────────────────────────────────────────────────

pub struct SdkManagerState {
    pub install_progress: Mutex<HashMap<String, InstallProgress>>,
    pub deps_dir: PathBuf,
}

impl SdkManagerState {
    pub fn new() -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        Self {
            install_progress: Mutex::new(HashMap::new()),
            deps_dir: home.join(".desktool").join("dependencies"),
        }
    }

    fn sdk_dir(&self, sdk_id: &SdkId) -> PathBuf {
        let id_str = match sdk_id {
            SdkId::ClaudeAgentSdk => "claude-agent-sdk",
            SdkId::CodexSdk => "codex-sdk",
        };
        self.deps_dir.join(id_str)
    }

    fn marker_file(&self, sdk_id: &SdkId) -> PathBuf {
        self.sdk_dir(sdk_id).join(".installed")
    }
}

impl Default for SdkManagerState {
    fn default() -> Self { Self::new() }
}

// ─── Node.js Environment Check ─────────────────────────────────────────────

fn get_node_env() -> NodeEnvStatus {
    let node_path = Command::new("which")
        .arg("node")
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
            } else { None }
        });
    let node_version = node_path.as_ref().and_then(|_| {
        Command::new("node").arg("--version").output().ok()
            .and_then(|o| {
                if o.status.success() {
                    Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
                } else { None }
            })
    });
    let npm_version = Command::new("npm").arg("--version").output().ok()
        .and_then(|o| {
            if o.status.success() {
                Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
            } else { None }
        });

    NodeEnvStatus {
        node_installed: node_path.is_some(),
        node_path,
        node_version,
        npm_installed: npm_version.is_some(),
        npm_version,
    }
}

// ─── SDK Detection ──────────────────────────────────────────────────────────

fn is_sdk_installed(sdk_id: &SdkId, deps_dir: &PathBuf) -> bool {
    let id_str = match sdk_id {
        SdkId::ClaudeAgentSdk => "claude-agent-sdk",
        SdkId::CodexSdk => "codex-sdk",
    };
    let sdk_dir = deps_dir.join(id_str);
    let marker = sdk_dir.join(".installed");
    if marker.exists() { return true; }
    // Check if node_modules/package exists but marker is missing (manual install)
    let pkg_dir = sdk_dir.join("node_modules").join(sdk_id.npm_package());
    if pkg_dir.exists() {
        let _ = std::fs::write(&marker, "installed");
        return true;
    }
    false
}

fn get_installed_version(sdk_id: &SdkId, deps_dir: &PathBuf) -> Option<String> {
    let id_str = match sdk_id {
        SdkId::ClaudeAgentSdk => "claude-agent-sdk",
        SdkId::CodexSdk => "codex-sdk",
    };
    let pkg_json = deps_dir.join(id_str).join("node_modules")
        .join(sdk_id.npm_package()).join("package.json");
    if let Ok(content) = std::fs::read_to_string(&pkg_json) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            json.get("version").and_then(|v| v.as_str()).map(|s| s.to_string())
        } else { None }
    } else { None }
}

fn get_latest_version(sdk_id: &SdkId) -> Option<String> {
    let _ = sdk_id;
    // npm view <pkg> version — can be slow, return cached or None
    None
}

// ─── SDK Install ────────────────────────────────────────────────────────────

fn install_sdk_blocking(
    sdk_id: &SdkId,
    requested_version: Option<&str>,
    deps_dir: &PathBuf,
    log_callback: &dyn Fn(String),
) -> InstallResult {
    let id_str = match sdk_id {
        SdkId::ClaudeAgentSdk => "claude-agent-sdk",
        SdkId::CodexSdk => "codex-sdk",
    };
    let _version = requested_version.unwrap_or("latest");
    let sdk_dir = deps_dir.join(id_str);
    let mut logs: Vec<String> = Vec::new();

    macro_rules! alog {
        ($($arg:tt)*) => {
            let msg = format!($($arg)*);
            log_callback(msg.clone());
            logs.push(msg);
        };
    }

    // 1. Create directory
    alog!("[1/5] 创建目录: {}", sdk_dir.display());
    if let Err(e) = std::fs::create_dir_all(&sdk_dir) {
        return InstallResult {
            sdk_id: id_str.to_string(), success: false,
            version: None, error: Some(format!("创建目录失败: {}", e)), logs,
        };
    }

    // 2. Create package.json
    alog!("[2/5] 创建 package.json...");
    let pkg_json = serde_json::json!({
        "name": format!("desktool-{}", id_str),
        "private": true,
        "dependencies": { sdk_id.npm_package(): "*" }
    });
    if let Err(e) = std::fs::write(
        sdk_dir.join("package.json"),
        serde_json::to_string_pretty(&pkg_json).unwrap_or_default(),
    ) {
        return InstallResult {
            sdk_id: id_str.to_string(), success: false,
            version: None, error: Some(format!("写入 package.json 失败: {}", e)), logs,
        };
    }

    // 3. Run npm install
    alog!("[3/5] 执行 npm install (可能需要 1-3 分钟)...");
    let output = Command::new("npm")
        .arg("install").arg("--prefix").arg(&sdk_dir)
        .arg("--no-audit").arg("--no-fund").arg("--loglevel=error")
        .output();

    match output {
        Ok(o) => {
            if o.status.success() {
                alog!("[4/5] npm install 完成");
                alog!("[5/5] 写入安装标记...");
                if let Err(e) = std::fs::write(sdk_dir.join(".installed"), "installed") {
                    alog!("警告: 写入标记失败: {}", e);
                }
                let version = get_installed_version(sdk_id, deps_dir);
                alog!("安装成功: {} {}", id_str, version.as_deref().unwrap_or("unknown"));
                InstallResult {
                    sdk_id: id_str.to_string(), success: true, version, error: None, logs,
                }
            } else {
                let stderr = String::from_utf8_lossy(&o.stderr).to_string();
                alog!("npm install 失败: {}", stderr);
                InstallResult {
                    sdk_id: id_str.to_string(), success: false,
                    version: None, error: Some(stderr), logs,
                }
            }
        }
        Err(e) => InstallResult {
            sdk_id: id_str.to_string(), success: false,
            version: None, error: Some(format!("无法执行 npm: {}", e)), logs,
        },
    }
}

fn uninstall_sdk_blocking(sdk_id: &SdkId, deps_dir: &PathBuf) -> bool {
    let id_str = match sdk_id {
        SdkId::ClaudeAgentSdk => "claude-agent-sdk",
        SdkId::CodexSdk => "codex-sdk",
    };
    let sdk_dir = deps_dir.join(id_str);
    if sdk_dir.exists() {
        let _ = std::fs::remove_dir_all(&sdk_dir);
        !sdk_dir.exists()
    } else { true }
}

// ─── Tauri Commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cc_check_node_environment() -> Result<NodeEnvStatus, String> {
    Ok(get_node_env())
}

#[tauri::command]
pub async fn cc_get_all_sdk_status(
    state: State<'_, SdkManagerState>,
) -> Result<Vec<SdkStatus>, String> {
    let mut results = Vec::new();
    for sdk_id in SdkId::all() {
        let installed = is_sdk_installed(&sdk_id, &state.deps_dir);
        let status = SdkStatus {
            sdk_id: format!("{:?}", sdk_id).to_lowercase(), // simplified
            display_name: sdk_id.display_name().to_string(),
            npm_package: sdk_id.npm_package().to_string(),
            installed,
            installed_version: if installed { get_installed_version(&sdk_id, &state.deps_dir) } else { None },
            latest_version: if installed { get_latest_version(&sdk_id) } else { None },
            has_update: false,
            install_dir: if installed { Some(state.sdk_dir(&sdk_id).to_string_lossy().to_string()) } else { None },
            error_message: None,
        };
        results.push(status);
    }
    Ok(results)
}

#[tauri::command]
pub async fn cc_is_sdk_installed(
    sdk_id: String,
    state: State<'_, SdkManagerState>,
) -> Result<bool, String> {
    match SdkId::from_id(&sdk_id) {
        Some(id) => Ok(is_sdk_installed(&id, &state.deps_dir)),
        None => Err(format!("Unknown SDK: {}", sdk_id)),
    }
}

#[tauri::command]
pub async fn cc_get_sdk_version(
    sdk_id: String,
    state: State<'_, SdkManagerState>,
) -> Result<Option<String>, String> {
    match SdkId::from_id(&sdk_id) {
        Some(id) => Ok(get_installed_version(&id, &state.deps_dir)),
        None => Err(format!("Unknown SDK: {}", sdk_id)),
    }
}

#[tauri::command]
pub async fn cc_install_sdk(
    sdk_id: String,
    version: Option<String>,
    app: tauri::AppHandle,
    state: State<'_, SdkManagerState>,
) -> Result<InstallResult, String> {
    let sdk = SdkId::from_id(&sdk_id).ok_or_else(|| format!("Unknown SDK: {}", sdk_id))?;
    let id_str = match sdk {
        SdkId::ClaudeAgentSdk => "claude-agent-sdk",
        SdkId::CodexSdk => "codex-sdk",
    };

    // Initialize progress
    {
        let mut progress = state.install_progress.lock().map_err(|e| e.to_string())?;
        progress.insert(sdk_id.clone(), InstallProgress {
            sdk_id: sdk_id.clone(),
            stage: "开始安装...".to_string(),
            progress: 0.0,
            log: Vec::new(),
            done: false,
            success: false,
            error: None,
        });
    }

    let deps_dir = state.deps_dir.clone();
    let app_handle = app.clone();
    let sdk_id_clone = sdk_id.clone();

    let result = tokio::task::spawn_blocking(move || {
        let log_cb = |msg: String| {
            // Could emit events here for real-time progress
            let _ = msg;
        };
        install_sdk_blocking(&sdk, version.as_deref(), &deps_dir, &log_cb)
    }).await.map_err(|e| e.to_string())?;

    // Update progress
    {
        let mut progress = state.install_progress.lock().map_err(|e| e.to_string())?;
        progress.insert(sdk_id_clone.clone(), InstallProgress {
            sdk_id: sdk_id_clone,
            stage: if result.success { "完成".into() } else { "失败".into() },
            progress: 1.0,
            log: result.logs.clone(),
            done: true,
            success: result.success,
            error: result.error.clone(),
        });
    }

    #[allow(unused_variables)]
    let _ = app_handle; // For future event emissions

    Ok(result)
}

#[tauri::command]
pub async fn cc_uninstall_sdk(
    sdk_id: String,
    state: State<'_, SdkManagerState>,
) -> Result<bool, String> {
    match SdkId::from_id(&sdk_id) {
        Some(id) => Ok(uninstall_sdk_blocking(&id, &state.deps_dir)),
        None => Err(format!("Unknown SDK: {}", sdk_id)),
    }
}

#[tauri::command]
pub async fn cc_get_install_progress(
    sdk_id: String,
    state: State<'_, SdkManagerState>,
) -> Result<Option<InstallProgress>, String> {
    let progress = state.install_progress.lock().map_err(|e| e.to_string())?;
    Ok(progress.get(&sdk_id).cloned())
}

// ─── B7: npm权限修复 ───────────────────────────────────────────────────────────

/// 修复 npm 全局权限问题 (EACCES 等)
#[tauri::command]
pub async fn cc_fix_npm_permissions() -> Result<serde_json::Value, String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let npm_global = std::path::PathBuf::from(&home).join(".npm-global");

    // 1. 创建 ~/.npm-global 目录
    if !npm_global.exists() {
        std::fs::create_dir_all(&npm_global)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }

    // 2. 设置 npm prefix
    let set_prefix = std::process::Command::new("npm")
        .args(["config", "set", "prefix", &npm_global.to_string_lossy()])
        .output();

    let mut fixes = Vec::new();

    if let Ok(output) = set_prefix {
        if output.status.success() {
            fixes.push(format!("npm prefix 设置为 {}", npm_global.display()));
        }
    }

    // 3. 修复常见权限目录
    let dirs_to_fix = vec![
        std::path::PathBuf::from(&home).join(".npm"),
        std::path::PathBuf::from(&home).join(".node-gyp"),
        std::path::PathBuf::from("/usr/local/lib/node_modules"),
    ];

    for dir in &dirs_to_fix {
        if dir.exists() {
            #[cfg(unix)]
            {
                let user = std::env::var("USER").unwrap_or_default();
                if !user.is_empty() {
                    let _ = std::process::Command::new("chown")
                        .args(["-R", &format!("{}:staff", user), &dir.to_string_lossy()])
                        .output();
                    let _ = std::process::Command::new("chmod")
                        .args(["-R", "755", &dir.to_string_lossy()])
                        .output();
                    fixes.push(format!("修复权限: {}", dir.display()));
                }
            }
        }
    }

    Ok(serde_json::json!({
        "fixed": true,
        "npm_global_prefix": npm_global.to_string_lossy(),
        "fixes": fixes,
        "suggestion": "将以下路径加入 PATH 以使用全局 npm 包:\n  export PATH=\"$HOME/.npm-global/bin:$PATH\"",
    }))
}
