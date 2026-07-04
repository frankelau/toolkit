// handler/history.rs — 历史会话 handler
// Sprint S2: 处理历史会话相关的 Provider 事件（session_id / threadId 提取）

use async_trait::async_trait;

use crate::cc_agent::handler::{HandlerContext, MessageHandler};
use crate::cc_agent::provider::ProviderEvent;

/// 历史会话 Handler
///
/// 监听 System 事件，提取 session_id（Claude）和 threadId（Codex），
/// 用于后续的历史会话关联。
pub struct HistoryHandler;

impl HistoryHandler {
    pub fn new() -> Self {
        Self
    }
}

impl Default for HistoryHandler {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl MessageHandler for HistoryHandler {
    fn name(&self) -> &'static str {
        "HistoryHandler"
    }

    async fn handle(&self, event: &ProviderEvent, ctx: &HandlerContext) -> bool {
        match event {
            ProviderEvent::System { data } => {
                // 提取 session_id（Claude）
                if let Some(sid) = data.get("session_id").and_then(|v| v.as_str()) {
                    tracing_debug(&format!(
                        "[HistoryHandler] Claude session_id extracted: {} for session {}",
                        sid, ctx.session_id
                    ));
                }

                // 提取 threadId（Codex）
                if let Some(tid) = data.get("threadId").and_then(|v| v.as_str()) {
                    tracing_debug(&format!(
                        "[HistoryHandler] Codex threadId extracted: {} for session {}",
                        tid, ctx.session_id
                    ));
                }

                // 不阻止后续 handler
                false
            }
            _ => false,
        }
    }
}

/// 简单的 debug 日志（避免引入 tracing 依赖）
fn tracing_debug(msg: &str) {
    #[cfg(debug_assertions)]
    eprintln!("[cc-agent] {}", msg);
}

// ─── Y1 增强：会话搜索 / 过滤 / 元数据 ──────────────────────────────────────────

use std::path::{Path, PathBuf};
use std::fs;

/// 会话摘要
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SessionSummary {
    pub id: String,
    pub thread_id: Option<String>,
    pub title: Option<String>,
    pub message_count: usize,
    pub last_message_at: Option<String>,
    pub engine: Option<String>,
    pub cwd: String,
}

/// 搜索会话目录
///
/// 会话存储路径：~/.claude/projects/{project_name}/
pub fn search_sessions(
    home: &Path,
    project_name: &str,
    filter: &SessionFilter,
) -> Vec<SessionSummary> {
    let sessions_dir = home.join(".claude").join("projects").join(project_name);
    if !sessions_dir.is_dir() {
        return vec![];
    }

    let mut summaries = Vec::new();
    if let Ok(entries) = fs::read_dir(&sessions_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            if let Some(summary) = extract_session_summary(&path, project_name) {
                if filter.matches(&summary) {
                    summaries.push(summary);
                }
            }
        }
    }

    // 按最后消息时间降序排列
    summaries.sort_by(|a, b| {
        b.last_message_at.cmp(&a.last_message_at)
    });

    summaries
}

/// 会话搜索过滤器
#[derive(Debug, Clone, Default)]
pub struct SessionFilter {
    pub query: Option<String>,
    pub engine: Option<String>,
    pub min_messages: Option<usize>,
    pub date_after: Option<String>,
    pub limit: Option<usize>,
}

impl SessionFilter {
    fn matches(&self, summary: &SessionSummary) -> bool {
        if let Some(ref q) = self.query {
            let q_lower = q.to_lowercase();
            let title_match = summary.title.as_ref()
                .map(|t| t.to_lowercase().contains(&q_lower))
                .unwrap_or(false);
            let id_match = summary.id.to_lowercase().contains(&q_lower);
            if !title_match && !id_match {
                return false;
            }
        }

        if let Some(ref eng) = self.engine {
            if summary.engine.as_deref() != Some(eng) {
                return false;
            }
        }

        if let Some(min) = self.min_messages {
            if summary.message_count < min {
                return false;
            }
        }

        true
    }
}

/// 从会话目录提取摘要
fn extract_session_summary(dir: &Path, _project: &str) -> Option<SessionSummary> {
    let id = dir.file_name()?.to_string_lossy().to_string();

    // 尝试读取 .jsonl 日志文件
    let jsonl_path = dir.join("messages.jsonl");
    let message_count = if jsonl_path.exists() {
        fs::read_to_string(&jsonl_path)
            .map(|c| c.lines().count())
            .unwrap_or(0)
    } else {
        0
    };

    let summary = SessionSummary {
        id,
        thread_id: None,
        title: extract_session_title(dir),
        message_count,
        last_message_at: extract_last_modified(dir),
        engine: None,
        cwd: dir.to_string_lossy().to_string(),
    };

    Some(summary)
}

fn extract_session_title(dir: &Path) -> Option<String> {
    // 尝试从会话目录的第一个 user 消息提取标题
    let jsonl = dir.join("messages.jsonl");
    if jsonl.exists() {
        if let Ok(content) = fs::read_to_string(&jsonl) {
            for line in content.lines().take(5) {
                if let Ok(msg) = serde_json::from_str::<serde_json::Value>(line) {
                    if msg.get("role").and_then(|v| v.as_str()) == Some("user") {
                        if let Some(text) = msg.get("content").and_then(|v| v.as_str()) {
                            let title: String = text.chars().take(80).collect();
                            return Some(if text.len() > 80 {
                                format!("{}...", title)
                            } else {
                                title
                            });
                        }
                    }
                }
            }
        }
    }
    None
}

fn extract_last_modified(dir: &Path) -> Option<String> {
    fs::metadata(dir).ok().and_then(|m| m.modified().ok()).map(|t| {
        format!("{:?}", t)
    })
}

/// 删除会话
pub fn delete_session(home: &Path, project_name: &str, session_id: &str) -> Result<(), String> {
    let session_dir = home.join(".claude").join("projects").join(project_name).join(session_id);
    if !session_dir.exists() {
        return Err(format!("会话 {} 不存在", session_id));
    }
    fs::remove_dir_all(&session_dir)
        .map_err(|e| format!("删除失败: {}", e))
}

/// 统计会话信息
#[derive(Debug, Clone, serde::Serialize)]
pub struct SessionStats {
    pub total_sessions: usize,
    pub total_messages: usize,
    pub active_today: usize,
    pub active_this_week: usize,
}

pub fn get_session_stats(home: &Path, project_name: &str) -> SessionStats {
    let sessions_dir = home.join(".claude").join("projects").join(project_name);
    SessionStats {
        total_sessions: count_sessions(&sessions_dir),
        total_messages: 0, // 需要遍历才能获取
        active_today: 0,
        active_this_week: 0,
    }
}

fn count_sessions(dir: &Path) -> usize {
    if !dir.is_dir() {
        return 0;
    }
    fs::read_dir(dir)
        .map(|entries| entries.flatten().filter(|e| e.path().is_dir()).count())
        .unwrap_or(0)
}

#[cfg(test)]
mod history_tests {
    use super::*;

    #[test]
    fn test_filter_query() {
        let summary = SessionSummary {
            id: "abc123".into(),
            thread_id: None,
            title: Some("Fix login bug".into()),
            message_count: 10,
            last_message_at: Some("2026-07-01".into()),
            engine: None,
            cwd: "/project".into(),
        };

        let filter = SessionFilter {
            query: Some("login".into()),
            ..Default::default()
        };
        assert!(filter.matches(&summary));

        let no_match = SessionFilter {
            query: Some("dashboard".into()),
            ..Default::default()
        };
        assert!(!no_match.matches(&summary));
    }

    #[test]
    fn test_filter_min_messages() {
        let summary = SessionSummary {
            id: "abc".into(),
            thread_id: None,
            title: None,
            message_count: 5,
            last_message_at: None,
            engine: None,
            cwd: "/p".into(),
        };

        let filter = SessionFilter {
            min_messages: Some(10),
            ..Default::default()
        };
        assert!(!filter.matches(&summary));

        let filter = SessionFilter {
            min_messages: Some(3),
            ..Default::default()
        };
        assert!(filter.matches(&summary));
    }
}

// ─── B5-4: 子Agent会话历史 + 会话导出 + 批量删除 ────────────────────────────────

fn home_dir() -> PathBuf {
    std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/tmp"))
}

/// 获取子Agent会话历史
#[tauri::command]
pub async fn cc_get_subagent_history(
    parent_session_id: String,
) -> Result<serde_json::Value, String> {
    let claude_dir = home_dir().join(".claude").join("projects");
    let mut sub_sessions = Vec::new();

    if let Ok(entries) = fs::read_dir(&claude_dir) {
        for entry in entries.flatten() {
            let project_dir = entry.path();
            if !project_dir.is_dir() { continue; }
            if let Ok(sessions) = fs::read_dir(&project_dir) {
                for s in sessions.flatten() {
                    let session_dir = s.path();
                    if !session_dir.is_dir() { continue; }
                    let sid = session_dir.file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    if sid.contains(&parent_session_id) && sid != parent_session_id {
                        let msg_count = fs::read_dir(&session_dir)
                            .map(|d| d.filter(|e| {
                                e.as_ref().map(|f| {
                                    f.path().extension().map_or(false, |ext| ext == "jsonl")
                                }).unwrap_or(false)
                            }).count())
                            .unwrap_or(0);
                        sub_sessions.push(serde_json::json!({
                            "id": sid,
                            "message_count": msg_count,
                        }));
                    }
                }
            }
        }
    }

    Ok(serde_json::json!({
        "parent_session_id": parent_session_id,
        "subagent_count": sub_sessions.len(),
        "sub_sessions": sub_sessions,
    }))
}

/// 导出会话为 Markdown
#[tauri::command]
pub async fn cc_export_session(
    session_id: String,
    format: Option<String>,
    output_path: Option<String>,
) -> Result<serde_json::Value, String> {
    let fmt = format.as_deref().unwrap_or("markdown");
    let claude_dir = home_dir().join(".claude").join("projects");

    let mut md = String::new();
    md.push_str(&format!("# Session: {}\n\n", session_id));

    // 查找会话目录
    let mut found = false;
    if let Ok(entries) = fs::read_dir(&claude_dir) {
        for entry in entries.flatten() {
            let project_dir = entry.path();
            if !project_dir.is_dir() { continue; }
            let session_dir = project_dir.join(&session_id);
            if session_dir.is_dir() {
                found = true;
                md.push_str(&format!("- Path: {}\n", session_dir.display()));
                if let Ok(files) = fs::read_dir(&session_dir) {
                    for f in files.flatten() {
                        let path = f.path();
                        if path.extension().map_or(false, |ext| ext == "jsonl") {
                            if let Ok(content) = fs::read_to_string(&path) {
                                for line in content.lines() {
                                    let preview: String = line.chars().take(200).collect();
                                    md.push_str(&format!("- {}\n", preview));
                                }
                            }
                        }
                    }
                }
                break;
            }
        }
    }
    if !found {
        md.push_str("_Session not found on disk_\n");
    }

    let out_path = output_path.unwrap_or_else(|| {
        format!("/tmp/session_{}.md", &session_id[..8.min(session_id.len())])
    });
    fs::write(&out_path, &md).map_err(|e| format!("写入失败: {}", e))?;

    Ok(serde_json::json!({
        "exported": true,
        "format": fmt,
        "output_path": out_path,
        "session_id": session_id,
        "size": md.len(),
    }))
}

/// 批量删除会话
#[tauri::command]
pub async fn cc_delete_sessions(
    session_ids: Vec<String>,
) -> Result<serde_json::Value, String> {
    let claude_dir = home_dir().join(".claude").join("projects");
    let mut deleted = 0usize;
    let mut failed = Vec::new();

    for sid in &session_ids {
        let mut removed = false;
        if let Ok(entries) = fs::read_dir(&claude_dir) {
            for entry in entries.flatten() {
                let project_dir = entry.path();
                if !project_dir.is_dir() { continue; }
                let session_dir = project_dir.join(sid);
                if session_dir.is_dir() {
                    match fs::remove_dir_all(&session_dir) {
                        Ok(_) => { deleted += 1; removed = true; }
                        Err(e) => failed.push(format!("{}: {}", sid, e)),
                    }
                    break;
                }
            }
        }
        if !removed && failed.iter().all(|f: &String| !f.starts_with(sid)) {
            deleted += 1;
        }
    }

    Ok(serde_json::json!({
        "deleted": deleted,
        "failed": failed.len(),
        "failed_details": failed,
    }))
}
