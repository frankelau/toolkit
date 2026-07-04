// history.rs — 历史会话索引与搜索
// Sprint L: 从 cc_agent.rs 拆分

use std::sync::OnceLock;

static SESSION_INDEX: OnceLock<std::sync::Mutex<SessionIndex>> = OnceLock::new();

struct SessionIndex {
    entries: Vec<SessionIndexEntry>,
    last_refresh: std::time::Instant,
}

#[derive(Clone, serde::Serialize)]
struct SessionIndexEntry {
    session_id: String,
    project: String,
    summary: String,
    modified: u64,
    message_count: usize,
}

impl SessionIndex {
    fn new() -> Self {
        Self { entries: Vec::new(), last_refresh: std::time::Instant::now() }
    }

    fn is_stale(&self) -> bool {
        self.last_refresh.elapsed() > std::time::Duration::from_secs(60)
    }
}

/// List available Claude sessions from disk
#[tauri::command]
pub async fn cc_list_claude_sessions() -> Result<Vec<serde_json::Value>, String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let projects_dir = format!("{}/.claude/projects", home);
    let mut sessions = Vec::new();

    if !std::path::Path::new(&projects_dir).exists() {
        return Ok(sessions);
    }

    if let Ok(entries) = std::fs::read_dir(&projects_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let project_name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            if let Ok(session_entries) = std::fs::read_dir(&path) {
                for se in session_entries.flatten() {
                    let sp = se.path();
                    if sp.extension().map(|e| e == "jsonl").unwrap_or(false) {
                        let session_id = sp.file_stem().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                        let modified = se.metadata().ok().and_then(|m| m.modified().ok())
                            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|d| d.as_secs());

                        let mut summary = String::new();
                        if let Ok(content) = std::fs::read_to_string(&sp) {
                            for line in content.lines().take(5) {
                                if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                                    if let Some(arr) = json.get("message").and_then(|m| m.get("content")).and_then(|c| c.as_array()) {
                                        for item in arr {
                                            if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                                                summary = text.chars().take(80).collect();
                                                break;
                                            }
                                        }
                                        if !summary.is_empty() { break; }
                                    }
                                }
                            }
                        }

                        sessions.push(serde_json::json!({
                            "session_id": session_id,
                            "project": project_name,
                            "summary": summary,
                            "modified": modified,
                        }));
                    }
                }
            }
        }
    }

    sessions.sort_by(|a, b| {
        b.get("modified").and_then(|v| v.as_u64()).unwrap_or(0)
            .cmp(&a.get("modified").and_then(|v| v.as_u64()).unwrap_or(0))
    });

    Ok(sessions)
}

/// Phase 9: 刷新会话索引缓存（强制全量扫描）
#[tauri::command]
pub async fn cc_refresh_session_index() -> Result<serde_json::Value, String> {
    let index = SESSION_INDEX.get_or_init(|| std::sync::Mutex::new(SessionIndex::new()));
    let mut idx = index.lock().map_err(|e| e.to_string())?;

    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let projects_dir = format!("{}/.claude/projects", home);
    let mut entries = Vec::new();

    if std::path::Path::new(&projects_dir).exists() {
        if let Ok(proj_entries) = std::fs::read_dir(&projects_dir) {
            for pe in proj_entries.flatten() {
                let ppath = pe.path();
                if !ppath.is_dir() { continue; }
                let project = ppath.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();

                if let Ok(sess_entries) = std::fs::read_dir(&ppath) {
                    for se in sess_entries.flatten() {
                        let spath = se.path();
                        if spath.extension().map(|e| e == "jsonl").unwrap_or(false) {
                            let session_id = spath.file_stem().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                            let modified = se.metadata().ok()
                                .and_then(|m| m.modified().ok())
                                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                                .map(|d| d.as_secs())
                                .unwrap_or(0);

                            let mut message_count = 0usize;
                            let mut summary = String::new();
                            if let Ok(content) = std::fs::read_to_string(&spath) {
                                for line in content.lines() {
                                    message_count += 1;
                                    if summary.is_empty() {
                                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                                            if let Some(arr) = json.get("message").and_then(|m| m.get("content")).and_then(|c| c.as_array()) {
                                                for item in arr {
                                                    if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                                                        summary = text.chars().take(80).collect();
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            entries.push(SessionIndexEntry {
                                session_id,
                                project: project.clone(),
                                summary,
                                modified,
                                message_count,
                            });
                        }
                    }
                }
            }
        }
    }

    entries.sort_by(|a, b| b.modified.cmp(&a.modified));
    let count = entries.len();
    idx.entries = entries;
    idx.last_refresh = std::time::Instant::now();

    Ok(serde_json::json!({ "success": true, "count": count }))
}

/// Phase 9: 搜索会话索引
#[tauri::command]
pub async fn cc_search_sessions(
    query: String,
    limit: Option<usize>,
) -> Result<Vec<serde_json::Value>, String> {
    let index = SESSION_INDEX.get_or_init(|| std::sync::Mutex::new(SessionIndex::new()));

    let need_refresh = {
        let idx = index.lock().map_err(|e| e.to_string())?;
        idx.entries.is_empty() || idx.is_stale()
    };
    if need_refresh {
        let _ = cc_refresh_session_index().await;
    }

    let idx = index.lock().map_err(|e| e.to_string())?;
    let q = query.to_lowercase();
    let max = limit.unwrap_or(50);
    let results: Vec<serde_json::Value> = idx.entries.iter()
        .filter(|e| {
            if q.is_empty() { return true; }
            e.summary.to_lowercase().contains(&q)
                || e.project.to_lowercase().contains(&q)
                || e.session_id.to_lowercase().contains(&q)
        })
        .take(max)
        .map(|e| serde_json::json!({
            "session_id": e.session_id,
            "project": e.project,
            "summary": e.summary,
            "modified": e.modified,
            "message_count": e.message_count,
        }))
        .collect();

    Ok(results)
}
