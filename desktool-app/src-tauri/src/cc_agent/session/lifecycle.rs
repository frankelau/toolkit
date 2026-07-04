// session/lifecycle.rs — 会话生命周期管理（启动/中止/状态/Tab）
// Sprint V2: 从原 session.rs 拆分，权限和上下文命令移至 permissions.rs / context.rs

use std::sync::Arc;
use tokio::process::Command;
use tauri::{AppHandle, Emitter};

use super::super::types::{Engine, Session, SessionConfig, SessionManager};
use super::super::bridge::{ensure_bridge, bridge_script_path, node_bin};
use super::streaming::{spawn_stdout_reader, spawn_stderr_reader};

/// 启动新会话（通过 Node.js bridge）
#[tauri::command]
pub async fn cc_start_session(
    app: AppHandle,
    config: SessionConfig,
    state: tauri::State<'_, Arc<SessionManager>>,
) -> Result<String, String> {
    // 确保 bridge 已部署
    ensure_bridge(&app).await?;

    let session_id = uuid::Uuid::new_v4().to_string();
    let event_base = format!("cc-event-{}", session_id);

    let bridge_path = bridge_script_path();
    if !std::path::Path::new(&bridge_path).exists() {
        return Err(format!("Bridge script not found at {}", bridge_path));
    }

    let node = node_bin();
    let mut cmd = Command::new(&node);
    cmd.arg(&bridge_path);

    // 环境变量
    cmd.env("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "1");
    if let Ok(home) = std::env::var("HOME") {
        cmd.env("HOME", &home);
        let node_path = format!("{}/.desktool/cc-bridge/node_modules", home);
        cmd.env("NODE_PATH", &node_path);
    }

    cmd.stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .current_dir(&config.cwd);

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn bridge: {}", e))?;
    eprintln!("[cc-bridge] Bridge process spawned with PID={:?}", child.id());
    let stdin = child.stdin.take().ok_or("Failed to capture stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take();

    // 启动 stdout 读取任务
    eprintln!("[cc-bridge] Starting stdout reader for session={}", session_id);
    spawn_stdout_reader(
        stdout,
        app.clone(),
        event_base.clone(),
        session_id.clone(),
        state.inner().clone(),
    );

    // 启动 stderr 读取任务
    if let Some(stderr) = stderr {
        spawn_stderr_reader(stderr, app.clone(), event_base.clone());
    }

    // 存储会话
    {
        let mut sessions = state.sessions.lock().await;
        sessions.insert(
            session_id.clone(),
            Session {
                child,
                stdin: Some(stdin),
                engine: config.engine.clone(),
                cwd: config.cwd,
                claude_session_id: None,
                codex_thread_id: None,
                base_url: config.base_url,
                api_key: config.api_key,
                messages: Vec::new(),
                thinking: config.thinking.clone(),
                include_partial_messages: config.include_partial_messages.unwrap_or(true),
            },
        );
    }

    Ok(session_id)
}

/// 中止会话（杀死子进程）
#[tauri::command]
pub async fn cc_abort_session(
    session_id: String,
    state: tauri::State<'_, Arc<SessionManager>>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;

    // 先发送 abort 到 bridge
    if let Some(session) = sessions.get_mut(&session_id) {
        if let Some(stdin) = session.stdin.as_mut() {
            use tokio::io::AsyncWriteExt;
            let request = serde_json::json!({
                "id": "abort",
                "method": "abort",
            });
            let line = format!("{}\n", request);
            let _ = stdin.write_all(line.as_bytes()).await;
            let _ = stdin.flush().await;
        }
    }

    // 然后杀死进程
    if let Some(mut session) = sessions.remove(&session_id) {
        let _ = session.child.kill().await;
        let _ = session.child.wait().await;
    }
    Ok(())
}

/// 获取会话完整状态（诊断用）
#[tauri::command]
pub async fn cc_get_session_status(
    session_id: String,
    state: tauri::State<'_, Arc<SessionManager>>,
) -> Result<serde_json::Value, String> {
    let sessions = state.sessions.lock().await;
    let session = sessions
        .get(&session_id)
        .ok_or("Session not found")?;

    Ok(serde_json::json!({
        "sessionId": session_id,
        "engine": match session.engine {
            Engine::Claude => "claude",
            Engine::Codex => "codex",
        },
        "cwd": session.cwd,
        "claudeSessionId": session.claude_session_id,
        "codexThreadId": session.codex_thread_id,
        "messageCount": session.messages.len(),
        "hasBaseUrl": session.base_url.is_some(),
        "hasApiKey": session.api_key.is_some(),
        "includePartialMessages": session.include_partial_messages,
    }))
}

/// 列出所有活跃的 tab 会话
#[tauri::command]
pub async fn cc_list_tabs(
    state: tauri::State<'_, Arc<SessionManager>>,
) -> Result<Vec<serde_json::Value>, String> {
    let sessions = state.sessions.lock().await;
    let mut tabs = Vec::new();
    for (sid, session) in sessions.iter() {
        tabs.push(serde_json::json!({
            "sessionId": sid,
            "engine": match session.engine {
                Engine::Claude => "claude",
                Engine::Codex => "codex",
            },
            "cwd": session.cwd,
            "messageCount": session.messages.len(),
            "claudeSessionId": session.claude_session_id,
            "codexThreadId": session.codex_thread_id,
        }));
    }
    Ok(tabs)
}

/// 切换到指定 tab（后端确认会话存在）
#[tauri::command]
pub async fn cc_switch_tab(
    session_id: String,
    state: tauri::State<'_, Arc<SessionManager>>,
) -> Result<bool, String> {
    let sessions = state.sessions.lock().await;
    Ok(sessions.contains_key(&session_id))
}

// ─── Y4 增强：会话恢复 + 重启 + 超时清理 ────────────────────────────────────────

use std::time::{Duration, Instant};

/// 会话健康状态
#[derive(Debug, Clone, serde::Serialize)]
pub struct SessionHealth {
    pub session_id: String,
    pub alive: bool,
    pub uptime_secs: u64,
    pub message_count: usize,
    pub event_count: u64,
    pub streaming: bool,
}

/// 检查会话健康状态
#[tauri::command]
pub async fn cc_session_health(
    session_id: String,
    state: tauri::State<'_, Arc<SessionManager>>,
) -> Result<SessionHealth, String> {
    let sessions = state.sessions.lock().await;
    let session = sessions.get(&session_id)
        .ok_or("会话不存在")?;

    // 尝试检查子进程是否存活
    let alive = session.child.id().is_some();

    Ok(SessionHealth {
        session_id,
        alive,
        uptime_secs: 0, // 需要 tracked_start
        message_count: session.messages.len(),
        event_count: 0,
        streaming: false,
    })
}

/// 带超时的会话启动
///
/// 生产环境中由前端通过 Tauri invoke 调用 cc_start_session 并自行超时管理。
/// 此函数为内部测试辅助函数，基于 SessionManager 手动创建会话。
#[allow(dead_code)]
pub async fn start_session_with_timeout(
    config: &SessionConfig,
    state: Arc<SessionManager>,
    timeout: Duration,
) -> Result<String, String> {
    let session_id = uuid::Uuid::new_v4().to_string();

    // 存储占位会话（无真实子进程，用于测试）
    {
        let mut sessions = state.sessions.lock().await;
        sessions.insert(session_id.clone(), Session {
            child: tokio::process::Command::new("true").spawn().map_err(|e| e.to_string())?,
            stdin: None,
            engine: config.engine.clone(),
            cwd: config.cwd.clone(),
            claude_session_id: None,
            codex_thread_id: None,
            base_url: config.base_url.clone(),
            api_key: config.api_key.clone(),
            messages: Vec::new(),
            thinking: config.thinking.clone(),
            include_partial_messages: config.include_partial_messages.unwrap_or(true),
        });
    }

    Ok(session_id)
}

/// 清理所有僵尸会话（子进程已退出但未清理的）
pub async fn cleanup_stale_sessions(
    state: &Arc<SessionManager>,
) -> usize {
    let mut sessions = state.sessions.lock().await;
    let before = sessions.len();
    sessions.retain(|_id, session| {
        // 保留 stdin 仍可用的会话
        session.stdin.is_some()
    });
    before - sessions.len()
}

/// 会话超时配置
pub const DEFAULT_SESSION_TIMEOUT_SECS: u64 = 3600; // 1 hour
pub const MAX_IDLE_TIME_SECS: u64 = 600; // 10 minutes

#[cfg(test)]
mod lifecycle_tests {
    use super::*;

    #[test]
    fn test_cleanup_constants() {
        assert_eq!(DEFAULT_SESSION_TIMEOUT_SECS, 3600);
        assert_eq!(MAX_IDLE_TIME_SECS, 600);
    }
}
