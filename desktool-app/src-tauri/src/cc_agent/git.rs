// git.rs — B5-3: AI生成Git提交消息
// 对齐 cc-gui GitCommitMessageService.java

use std::process::Command;

/// 获取 git diff --staged 输出
fn get_staged_diff(repo_path: &str) -> Result<String, String> {
    let output = Command::new("git")
        .args(["-C", repo_path, "diff", "--staged", "--", ":(exclude)*.lock"])
        .output()
        .map_err(|e| format!("执行 git diff 失败: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git diff 失败: {}", stderr));
    }

    let diff = String::from_utf8_lossy(&output.stdout).to_string();
    if diff.trim().is_empty() {
        return Err("没有暂存的变更 (git add 后再试)".to_string());
    }
    Ok(diff)
}

/// 获取 git log 最近 N 条提交（用于风格参考）
fn get_recent_commits(repo_path: &str, count: usize) -> Result<Vec<String>, String> {
    let output = Command::new("git")
        .args(["-C", repo_path, "log", &format!("-{}", count), "--pretty=format:%s"])
        .output()
        .map_err(|e| format!("执行 git log 失败: {}", e))?;

    if output.status.success() {
        let text = String::from_utf8_lossy(&output.stdout);
        Ok(text.lines().map(|l| l.trim().to_string()).filter(|l| !l.is_empty()).collect())
    } else {
        Ok(Vec::new())
    }
}

/// 获取当前分支名
fn get_branch_name(repo_path: &str) -> Result<String, String> {
    let output = Command::new("git")
        .args(["-C", repo_path, "rev-parse", "--abbrev-ref", "HEAD"])
        .output()
        .map_err(|e| format!("获取分支名失败: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Ok("unknown".to_string())
    }
}

/// 生成 Git 提交消息
/// 通过调用 claude CLI 分析 staged diff 生成规范提交消息
#[tauri::command]
pub async fn cc_generate_commit_message(
    repo_path: Option<String>,
    style_hint: Option<String>,
) -> Result<serde_json::Value, String> {
    let cwd = repo_path.unwrap_or_else(|| ".".to_string());

    // 1. 获取 staged diff + 分支 + 历史
    let diff = get_staged_diff(&cwd)?;
    let branch = get_branch_name(&cwd).unwrap_or_default();
    let recent = get_recent_commits(&cwd, 5).unwrap_or_default();

    // 2. 截断 diff (只取前 4000 字符避免 token 爆炸)
    let truncated = if diff.len() > 4000 {
        format!("{}...\n(diff truncated, {} total chars)", &diff[..4000], diff.len())
    } else {
        diff.clone()
    };

    // 3. 构建 prompt
    let style = style_hint.unwrap_or_else(|| "conventional commits (feat/fix/chore/refactor/docs)".to_string());
    let prompt = format!(
        "Generate a concise, single-line git commit message based on the staged diff below.\n\
         Follow the style: {style}\n\
         Branch: {branch}\n\
         \n\
         {}\n\
         \n\
         Return ONLY the commit message, nothing else. Max 72 characters if possible.\n\
         If the diff is too complex, summarize the main change concisely.",
        truncated
    );

    // 4. Try to call claude CLI to generate message
    let claude_output = Command::new("claude")
        .args(["-p", "--output-format", "text", "--"])
        .arg(&prompt)
        .output();

    match claude_output {
        Ok(out) if out.status.success() => {
            let message = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let clean_message = message
                .lines()
                .filter(|l| !l.starts_with('"') && !l.starts_with('`'))
                .collect::<Vec<_>>()
                .join(" ")
                .trim()
                .to_string();

            Ok(serde_json::json!({
                "success": true,
                "message": clean_message,
                "branch": branch,
                "diff_size": diff.len(),
                "source": "claude",
            }))
        }
        Ok(_) => {
            // Claude failed, try codex
            let codex_output = Command::new("codex")
                .args(["-p", "--"])
                .arg(&prompt)
                .output();

            match codex_output {
                Ok(out) if out.status.success() => {
                    let message = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    Ok(serde_json::json!({
                        "success": true,
                        "message": message,
                        "branch": branch,
                        "diff_size": diff.len(),
                        "source": "codex",
                    }))
                }
                _ => {
                    // Both failed: return prompt for frontend to handle
                    Err("无法连接 Claude CLI 或 Codex CLI，请确认已安装并配置".to_string())
                }
            }
        }
        Err(e) => {
            // Claude not found, try codex
            let codex_output = Command::new("codex")
                .args(["-p", "--"])
                .arg(&prompt)
                .output();

            match codex_output {
                Ok(out) if out.status.success() => {
                    let message = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    Ok(serde_json::json!({
                        "success": true,
                        "message": message,
                        "branch": branch,
                        "diff_size": diff.len(),
                        "source": "codex",
                    }))
                }
                _ => Err(format!("无法执行 CLI: {}", e)),
            }
        }
    }
}

/// 检查 git 仓库状态 (是否有暂存变更)
#[tauri::command]
pub async fn cc_get_git_status(repo_path: Option<String>) -> Result<serde_json::Value, String> {
    let cwd = repo_path.unwrap_or_else(|| ".".to_string());

    // Check if in a git repo
    let is_repo = Command::new("git")
        .args(["-C", &cwd, "rev-parse", "--is-inside-work-tree"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !is_repo {
        return Ok(serde_json::json!({
            "is_repo": false,
            "has_staged": false,
            "has_changes": false,
            "branch": null,
        }));
    }

    let branch = get_branch_name(&cwd).unwrap_or_default();
    let has_staged = get_staged_diff(&cwd).is_ok();

    // Check for unstaged changes
    let unstaged = Command::new("git")
        .args(["-C", &cwd, "diff", "--stat"])
        .output()
        .map(|o| !String::from_utf8_lossy(&o.stdout).trim().is_empty())
        .unwrap_or(false);

    Ok(serde_json::json!({
        "is_repo": true,
        "has_staged": has_staged,
        "has_changes": unstaged,
        "branch": branch,
    }))
}

// ─── B9: IDEA级Git管理命令 ──────────────────────────────────────────────────────

use std::path::Path;

/// Git 文件变更条目
#[derive(Debug, Clone, serde::Serialize)]
pub struct GitFileChange {
    pub path: String,
    pub status: String,         // "M" "A" "D" "R" "??" "AM" etc.
    pub staged: bool,
    pub additions: usize,
    pub deletions: usize,
}

/// 获取变更文件列表（对齐 git status --porcelain）
#[tauri::command]
pub async fn cc_get_git_changes(
    repo_path: Option<String>,
) -> Result<Vec<GitFileChange>, String> {
    let cwd = repo_path.unwrap_or_else(|| ".".to_string());
    let output = Command::new("git")
        .args(["-C", &cwd, "status", "--porcelain", "-u"])
        .output()
        .map_err(|e| format!("git status 失败: {}", e))?;

    let text = String::from_utf8_lossy(&output.stdout);
    let mut files = Vec::new();

    for line in text.lines() {
        if line.len() < 4 { continue; }
        let status_idx = &line[..2];
        let path = line[3..].trim().to_string();

        // XY status: X=staged Y=unstaged
        let staged_code = status_idx.chars().next().unwrap_or(' ');
        let unstaged_code = status_idx.chars().nth(1).unwrap_or(' ');

        if staged_code != ' ' && staged_code != '?' {
            files.push(GitFileChange {
                path: path.clone(),
                status: format!("{}", staged_code),
                staged: true,
                additions: 0,
                deletions: 0,
            });
        }
        if unstaged_code != ' ' {
            files.push(GitFileChange {
                path,
                status: format!("{}", unstaged_code),
                staged: false,
                additions: 0,
                deletions: 0,
            });
        }
    }

    // 获取每个文件的统计
    for f in &mut files {
        if f.status == "D" { continue; }
        if let Ok(out) = Command::new("git")
            .args(["-C", &cwd, "diff", "--numstat", "--", &f.path])
            .output()
        {
            let numstat = String::from_utf8_lossy(&out.stdout);
            if let Some(nums) = numstat.split_whitespace().next() {
                f.additions = nums.parse().unwrap_or(0);
                if let Some(d) = numstat.split_whitespace().nth(1) {
                    f.deletions = d.parse().unwrap_or(0);
                }
            }
        }
    }

    Ok(files)
}

/// 暂存文件
#[tauri::command]
pub async fn cc_stage_file(
    file_path: String,
    repo_path: Option<String>,
) -> Result<(), String> {
    let cwd = repo_path.unwrap_or_else(|| ".".to_string());
    Command::new("git")
        .args(["-C", &cwd, "add", "--", &file_path])
        .output()
        .map_err(|e| format!("git add 失败: {}", e))?;
    Ok(())
}

/// 取消暂存
#[tauri::command]
pub async fn cc_unstage_file(
    file_path: String,
    repo_path: Option<String>,
) -> Result<(), String> {
    let cwd = repo_path.unwrap_or_else(|| ".".to_string());
    Command::new("git")
        .args(["-C", &cwd, "reset", "HEAD", "--", &file_path])
        .output()
        .map_err(|e| format!("git reset 失败: {}", e))?;
    Ok(())
}

/// 暂存所有文件
#[tauri::command]
pub async fn cc_stage_all(repo_path: Option<String>) -> Result<(), String> {
    let cwd = repo_path.unwrap_or_else(|| ".".to_string());
    Command::new("git")
        .args(["-C", &cwd, "add", "-A"])
        .output()
        .map_err(|e| format!("git add -A 失败: {}", e))?;
    Ok(())
}

/// 撤销文件变更
#[tauri::command]
pub async fn cc_revert_file(
    file_path: String,
    repo_path: Option<String>,
) -> Result<(), String> {
    let cwd = repo_path.unwrap_or_else(|| ".".to_string());
    Command::new("git")
        .args(["-C", &cwd, "checkout", "--", &file_path])
        .output()
        .map_err(|e| format!("git checkout 失败: {}", e))?;
    Ok(())
}

/// 获取文件 diff
#[tauri::command]
pub async fn cc_get_git_file_diff(
    file_path: String,
    staged: Option<bool>,
    repo_path: Option<String>,
) -> Result<String, String> {
    let cwd = repo_path.unwrap_or_else(|| ".".to_string());
    let mut args = vec!["-C", &cwd, "diff"];
    if staged.unwrap_or(false) {
        args.push("--staged");
    }
    args.push("--");
    args.push(&file_path);

    let output = Command::new("git")
        .args(&args)
        .output()
        .map_err(|e| format!("git diff 失败: {}", e))?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// 获取分支列表
#[derive(Debug, Clone, serde::Serialize)]
pub struct GitBranch {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub ahead: usize,
    pub behind: usize,
}

#[tauri::command]
pub async fn cc_get_git_branches(
    repo_path: Option<String>,
) -> Result<Vec<GitBranch>, String> {
    let cwd = repo_path.unwrap_or_else(|| ".".to_string());
    let output = Command::new("git")
        .args(["-C", &cwd, "branch", "-a", "--no-color"])
        .output()
        .map_err(|e| format!("git branch 失败: {}", e))?;

    let text = String::from_utf8_lossy(&output.stdout);
    let mut branches = Vec::new();

    for line in text.lines() {
        let trimmed = line.trim();
        let mut name = trimmed.trim_start_matches("* ").to_string();
        let is_current = trimmed.starts_with('*');
        let is_remote = name.starts_with("remotes/");

        if is_remote {
            name = name.replacen("remotes/origin/", "", 1);
        }

        if name == "HEAD" { continue; }

        // 检测 ahead/behind
        let (ahead, behind) = if is_current {
            let ahead_out = Command::new("git")
                .args(["-C", &cwd, "rev-list", "--count", "@{upstream}..HEAD"])
                .output().ok();
            let behind_out = Command::new("git")
                .args(["-C", &cwd, "rev-list", "--count", "HEAD..@{upstream}"])
                .output().ok();

            let a = ahead_out
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .and_then(|s| s.trim().parse().ok())
                .unwrap_or(0);
            let b = behind_out
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .and_then(|s| s.trim().parse().ok())
                .unwrap_or(0);
            (a, b)
        } else {
            (0, 0)
        };

        if !branches.iter().any(|br: &GitBranch| br.name == name && br.is_remote == is_remote) {
            branches.push(GitBranch { name, is_current, is_remote, ahead, behind });
        }
    }

    // 当前分支排第一
    branches.sort_by(|a, b| b.is_current.cmp(&a.is_current));
    Ok(branches)
}

/// 创建新分支
#[tauri::command]
pub async fn cc_create_branch(
    branch_name: String,
    repo_path: Option<String>,
) -> Result<(), String> {
    let cwd = repo_path.unwrap_or_else(|| ".".to_string());
    Command::new("git")
        .args(["-C", &cwd, "checkout", "-b", &branch_name])
        .output()
        .map_err(|e| format!("创建分支失败: {}", e))?;
    Ok(())
}

/// 切换分支
#[tauri::command]
pub async fn cc_checkout_branch(
    branch_name: String,
    repo_path: Option<String>,
) -> Result<(), String> {
    let cwd = repo_path.unwrap_or_else(|| ".".to_string());
    Command::new("git")
        .args(["-C", &cwd, "checkout", &branch_name])
        .output()
        .map_err(|e| format!("切换分支失败: {}", e))?;
    Ok(())
}

/// Git 提交
#[tauri::command]
pub async fn cc_git_commit(
    message: String,
    repo_path: Option<String>,
) -> Result<serde_json::Value, String> {
    let cwd = repo_path.unwrap_or_else(|| ".".to_string());
    let output = Command::new("git")
        .args(["-C", &cwd, "commit", "-m", &message])
        .output()
        .map_err(|e| format!("提交失败: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Ok(serde_json::json!({
            "success": true,
            "message": stdout.trim().lines().last().unwrap_or("ok").to_string(),
        }))
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Git Pull
#[tauri::command]
pub async fn cc_git_pull(
    repo_path: Option<String>,
    rebase: Option<bool>,
) -> Result<serde_json::Value, String> {
    let cwd = repo_path.unwrap_or_else(|| ".".to_string());
    let mut args = vec!["-C", &cwd, "pull"];
    if rebase.unwrap_or(true) {
        args.push("--rebase");
    }

    let output = Command::new("git")
        .args(&args)
        .output()
        .map_err(|e| format!("pull 失败: {}", e))?;

    Ok(serde_json::json!({
        "success": output.status.success(),
        "output": String::from_utf8_lossy(&output.stdout).trim().to_string(),
        "error": String::from_utf8_lossy(&output.stderr).trim().to_string(),
    }))
}

/// Git Push
#[tauri::command]
pub async fn cc_git_push(
    repo_path: Option<String>,
) -> Result<serde_json::Value, String> {
    let cwd = repo_path.unwrap_or_else(|| ".".to_string());
    let output = Command::new("git")
        .args(["-C", &cwd, "push"])
        .output()
        .map_err(|e| format!("push 失败: {}", e))?;

    Ok(serde_json::json!({
        "success": output.status.success(),
        "output": String::from_utf8_lossy(&output.stdout).trim().to_string(),
        "error": String::from_utf8_lossy(&output.stderr).trim().to_string(),
    }))
}

/// Git Fetch
#[tauri::command]
pub async fn cc_git_fetch(
    repo_path: Option<String>,
) -> Result<serde_json::Value, String> {
    let cwd = repo_path.unwrap_or_else(|| ".".to_string());
    let output = Command::new("git")
        .args(["-C", &cwd, "fetch", "--all", "--prune"])
        .output()
        .map_err(|e| format!("fetch 失败: {}", e))?;

    Ok(serde_json::json!({
        "success": output.status.success(),
        "output": String::from_utf8_lossy(&output.stdout).trim().to_string(),
    }))
}

/// Git Log
#[derive(Debug, Clone, serde::Serialize)]
pub struct GitLogEntry {
    pub hash: String,
    pub short_hash: String,
    pub author: String,
    pub date: String,
    pub message: String,
    pub refs: Vec<String>,
}

#[tauri::command]
pub async fn cc_get_git_log(
    repo_path: Option<String>,
    max_count: Option<usize>,
) -> Result<Vec<GitLogEntry>, String> {
    let cwd = repo_path.unwrap_or_else(|| ".".to_string());
    let count = max_count.unwrap_or(30);

    let output = Command::new("git")
        .args([
            "-C", &cwd, "log",
            &format!("-{}", count),
            "--pretty=format:%H|%h|%an|%ad|%s|%D",
            "--date=relative",
        ])
        .output()
        .map_err(|e| format!("git log 失败: {}", e))?;

    let text = String::from_utf8_lossy(&output.stdout);
    let mut entries = Vec::new();

    for line in text.lines() {
        let parts: Vec<&str> = line.splitn(6, '|').collect();
        if parts.len() >= 5 {
            entries.push(GitLogEntry {
                hash: parts[0].to_string(),
                short_hash: parts[1].to_string(),
                author: parts[2].to_string(),
                date: parts[3].to_string(),
                message: parts[4].to_string(),
                refs: parts.get(5)
                    .map(|r| r.split(", ").map(|s| s.trim().to_string()).collect())
                    .unwrap_or_default(),
            });
        }
    }

    Ok(entries)
}
