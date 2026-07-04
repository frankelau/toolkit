// watcher.rs — 会话文件监听
// Sprint S4: 监听 Claude/Codex 会话文件变化
//
// 对齐 cc-gui 的 SessionWatcher：
// - 监听 ~/.claude/projects/ 下的 JSONL 文件变化
// - 监听 ~/.codex/sessions/ 下的会话文件
// - 文件变化时通知前端（通过 Tauri event）

use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter};

/// 会话文件监听器
pub struct SessionWatcher {
    app: AppHandle,
    watch_paths: Vec<PathBuf>,
    running: Arc<Mutex<bool>>,
}

impl SessionWatcher {
    pub fn new(app: AppHandle) -> Self {
        let mut paths = Vec::new();

        // Claude 会话目录
        if let Some(home) = dirs::home_dir() {
            paths.push(home.join(".claude").join("projects"));
            paths.push(home.join(".codex").join("sessions"));
        }

        Self {
            app,
            watch_paths: paths,
            running: Arc::new(Mutex::new(false)),
        }
    }

    /// 添加监听路径
    pub fn add_path(&mut self, path: PathBuf) {
        self.watch_paths.push(path);
    }

    /// 启动监听
    ///
    /// 每 `interval_ms` 毫秒扫描一次监听目录，检测文件变化。
    /// 变化时通过 `cc-session-file-changed` 事件通知前端。
    pub async fn start(&self, interval_ms: u64) {
        let mut running = self.running.lock().await;
        if *running {
            return; // 已在运行
        }
        *running = true;
        drop(running);

        let app = self.app.clone();
        let paths = self.watch_paths.clone();
        let running_clone = self.running.clone();

        tokio::spawn(async move {
            let interval = Duration::from_millis(interval_ms);
            let mut last_modified: HashMap<PathBuf, SystemTime> = HashMap::new();

            // 初始扫描
            for path in &paths {
                if path.exists() {
                    scan_directory(path, &mut last_modified).await;
                }
            }

            while *running_clone.lock().await {
                tokio::time::sleep(interval).await;

                let mut current_modified: HashMap<PathBuf, SystemTime> = HashMap::new();

                for path in &paths {
                    if path.exists() {
                        scan_directory(path, &mut current_modified).await;
                    }
                }

                // 检测变化
                let changes = detect_changes(&last_modified, &current_modified);
                if !changes.is_empty() {
                    let _ = app.emit(
                        "cc-session-file-changed",
                        serde_json::json!({
                            "changes": changes,
                            "timestamp": current_time_millis(),
                        }),
                    );
                }

                last_modified = current_modified;
            }
        });
    }

    /// 停止监听
    pub async fn stop(&self) {
        let mut running = self.running.lock().await;
        *running = false;
    }

    /// 是否正在运行
    pub async fn is_running(&self) -> bool {
        *self.running.lock().await
    }
}

use std::collections::HashMap;
use std::time::{Duration, SystemTime};

/// 扫描目录，记录所有文件的修改时间
async fn scan_directory(dir: &PathBuf, modified_map: &mut HashMap<PathBuf, SystemTime>) {
    let entries = match tokio::fs::read_dir(dir).await {
        Ok(e) => e,
        Err(_) => return,
    };

    let mut entries = entries;
    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        let metadata = match entry.metadata().await {
            Ok(m) => m,
            Err(_) => continue,
        };

        if metadata.is_dir() {
            Box::pin(scan_directory(&path, modified_map)).await;
        } else if metadata.is_file() {
            if let Ok(modified) = metadata.modified() {
                modified_map.insert(path, modified);
            }
        }
    }
}

/// 检测文件变化（新增、修改、删除）
fn detect_changes(
    old: &HashMap<PathBuf, SystemTime>,
    new: &HashMap<PathBuf, SystemTime>,
) -> Vec<serde_json::Value> {
    let mut changes = Vec::new();

    // 新增 / 修改
    for (path, modified) in new {
        match old.get(path) {
            None => {
                changes.push(serde_json::json!({
                    "type": "created",
                    "path": path.to_string_lossy(),
                }));
            }
            Some(old_modified) if modified != old_modified => {
                changes.push(serde_json::json!({
                    "type": "modified",
                    "path": path.to_string_lossy(),
                }));
            }
            _ => {}
        }
    }

    // 删除
    for path in old.keys() {
        if !new.contains_key(path) {
            changes.push(serde_json::json!({
                "type": "deleted",
                "path": path.to_string_lossy(),
            }));
        }
    }

    changes
}

/// 获取当前时间（毫秒）
fn current_time_millis() -> u64 {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Tauri 命令：启动会话文件监听
#[tauri::command]
pub async fn cc_start_session_watcher(
    app: AppHandle,
    interval_ms: Option<u64>,
    state: tauri::State<'_, Arc<Mutex<Option<SessionWatcher>>>>,
) -> Result<(), String> {
    let mut watcher_state = state.lock().await;
    if watcher_state.is_some() {
        return Ok(()); // 已在运行
    }

    let watcher = SessionWatcher::new(app);
    watcher.start(interval_ms.unwrap_or(2000)).await;
    *watcher_state = Some(watcher);
    Ok(())
}

/// Tauri 命令：停止会话文件监听
#[tauri::command]
pub async fn cc_stop_session_watcher(
    state: tauri::State<'_, Arc<Mutex<Option<SessionWatcher>>>>,
) -> Result<(), String> {
    let mut watcher_state = state.lock().await;
    if let Some(watcher) = watcher_state.take() {
        watcher.stop().await;
    }
    Ok(())
}
