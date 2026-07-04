// terminal.rs — 终端集成（基础版）
// Sprint S5: 终端命令执行与 PTY 管理
//
// 对齐 cc-gui 的 TerminalService：
// - 执行一次性终端命令
// - 管理长运行 PTY 会话
// - 捕获 stdout/stderr 并转发到前端

use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter};

/// 终端命令执行结果
#[derive(Debug, Clone, serde::Serialize)]
pub struct TerminalResult {
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub success: bool,
}

/// 执行一次性终端命令
///
/// 在指定工作目录下执行命令，捕获 stdout/stderr。
/// 超时时间默认 30 秒。
pub async fn execute_command(
    command: &str,
    cwd: &str,
    timeout_secs: Option<u64>,
) -> Result<TerminalResult, String> {
    let shell = if cfg!(target_os = "windows") {
        ("cmd", "/C")
    } else {
        ("sh", "-c")
    };

    let mut cmd = Command::new(shell.0);
    cmd.arg(shell.1).arg(command);
    cmd.current_dir(cwd);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let timeout = Duration::from_secs(timeout_secs.unwrap_or(30));

    let stdout_task = tokio::time::timeout(timeout, read_to_string(stdout));
    let stderr_task = tokio::time::timeout(timeout, read_to_string(stderr));

    let (stdout_result, stderr_result) = tokio::join!(stdout_task, stderr_task);

    let stdout = stdout_result
        .map_err(|_| "stdout read timeout".to_string())?
        .map_err(|e| e.to_string())?;
    let stderr = stderr_result
        .map_err(|_| "stderr read timeout".to_string())?
        .map_err(|e| e.to_string())?;

    let exit_status = child.wait().await.map_err(|e| e.to_string())?;
    let exit_code = exit_status.code();

    Ok(TerminalResult {
        exit_code,
        stdout,
        stderr,
        success: exit_status.success(),
    })
}

use std::time::Duration;

async fn read_to_string<R: tokio::io::AsyncRead + Unpin>(reader: R) -> std::io::Result<String> {
    let mut buf = String::new();
    let mut reader = BufReader::new(reader);
    let mut line = String::new();
    loop {
        line.clear();
        let n = reader.read_line(&mut line).await?;
        if n == 0 {
            break;
        }
        buf.push_str(&line);
    }
    Ok(buf)
}

// ─── PTY 会话管理 ───────────────────────────────────────────────────────────

/// PTY 会话
pub struct PtySession {
    pub id: String,
    pub child: tokio::process::Child,
    pub cwd: String,
}

/// 全局 PTY 会话管理器
pub struct PtyManager {
    sessions: Mutex<std::collections::HashMap<String, PtySession>>,
}

impl Default for PtyManager {
    fn default() -> Self {
        Self {
            sessions: Mutex::new(std::collections::HashMap::new()),
        }
    }
}

impl PtyManager {
    pub fn new() -> Self {
        Self::default()
    }

    /// 启动一个新的 PTY 会话
    pub async fn start(
        &self,
        app: AppHandle,
        cwd: String,
        command: Option<String>,
    ) -> Result<String, String> {
        let session_id = uuid::Uuid::new_v4().to_string();
        let event_base = format!("cc-terminal-{}", session_id);

        let shell = if cfg!(target_os = "windows") {
            "powershell".to_string()
        } else {
            std::env::var("SHELL").unwrap_or_else(|_| "bash".to_string())
        };

        let mut cmd = Command::new(&shell);
        cmd.current_dir(&cwd);
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());
        cmd.stdin(std::process::Stdio::piped());

        if let Some(cmd_str) = &command {
            cmd.arg("-c").arg(cmd_str);
        }

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn shell: {}", e))?;
        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let stderr = child.stderr.take();

        // 转发 stdout 到前端
        let app_clone = app.clone();
        let event_clone = event_base.clone();
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_clone.emit(
                    &event_clone,
                    serde_json::json!({
                        "type": "stdout",
                        "data": line,
                    }),
                );
            }
            let _ = app_clone.emit(
                &event_clone,
                serde_json::json!({
                    "type": "exit",
                }),
            );
        });

        // 转发 stderr
        if let Some(stderr) = stderr {
            let app_clone2 = app.clone();
            let event_clone2 = event_base.clone();
            tokio::spawn(async move {
                let reader = BufReader::new(stderr);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = app_clone2.emit(
                        &event_clone2,
                        serde_json::json!({
                            "type": "stderr",
                            "data": line,
                        }),
                    );
                }
            });
        }

        let session = PtySession {
            id: session_id.clone(),
            child,
            cwd,
        };

        self.sessions.lock().await.insert(session_id.clone(), session);

        Ok(session_id)
    }

    /// 终止 PTY 会话
    pub async fn kill(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        if let Some(mut session) = sessions.remove(session_id) {
            let _ = session.child.kill().await;
            let _ = session.child.wait().await;
        }
        Ok(())
    }

    /// 列出活跃的 PTY 会话
    pub async fn list(&self) -> Vec<serde_json::Value> {
        let sessions = self.sessions.lock().await;
        sessions
            .iter()
            .map(|(id, session)| {
                serde_json::json!({
                    "id": id,
                    "cwd": session.cwd,
                })
            })
            .collect()
    }
}

// ─── Tauri 命令 ─────────────────────────────────────────────────────────────

/// Tauri 命令：执行一次性终端命令
#[tauri::command]
pub async fn cc_execute_terminal_command(
    command: String,
    cwd: String,
    timeout_secs: Option<u64>,
) -> Result<serde_json::Value, String> {
    let result = execute_command(&command, &cwd, timeout_secs).await?;
    Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
}

/// Tauri 命令：启动 PTY 会话
#[tauri::command]
pub async fn cc_start_terminal(
    app: AppHandle,
    cwd: String,
    command: Option<String>,
    state: tauri::State<'_, Arc<PtyManager>>,
) -> Result<String, String> {
    state.start(app, cwd, command).await
}

/// Tauri 命令：终止 PTY 会话
#[tauri::command]
pub async fn cc_kill_terminal(
    session_id: String,
    state: tauri::State<'_, Arc<PtyManager>>,
) -> Result<(), String> {
    state.kill(&session_id).await
}

/// Tauri 命令：列出活跃 PTY 会话
#[tauri::command]
pub async fn cc_list_terminals(
    state: tauri::State<'_, Arc<PtyManager>>,
) -> Result<Vec<serde_json::Value>, String> {
    Ok(state.list().await)
}
