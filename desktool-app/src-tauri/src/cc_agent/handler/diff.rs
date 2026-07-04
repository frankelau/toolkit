// handler/diff.rs — Diff 计算 handler
// Sprint S2: 处理文件编辑的 Diff 生成

use async_trait::async_trait;

use crate::cc_agent::handler::{HandlerContext, MessageHandler};
use crate::cc_agent::provider::ProviderEvent;

/// Diff Handler
///
/// 监听 ToolResult 事件，当工具是文件编辑类（Edit/Write）时，
/// 生成 Diff 数据供前端展示。
pub struct DiffHandler;

impl DiffHandler {
    pub fn new() -> Self {
        Self
    }
}

impl Default for DiffHandler {
    fn default() -> Self {
        Self::new()
    }
}

/// 生成简单的行级 Diff
///
/// 返回 (added_lines, removed_lines) 数量
pub fn compute_line_diff(old: &str, new: &str) -> (usize, usize) {
    let old_lines: Vec<&str> = old.lines().collect();
    let new_lines: Vec<&str> = new.lines().collect();

    let mut added = 0;
    let mut removed = 0;

    // 简化算法：逐行比较公共前缀和后缀
    let common_prefix = old_lines
        .iter()
        .zip(new_lines.iter())
        .take_while(|(a, b)| a == b)
        .count();

    let common_suffix = old_lines[common_prefix..]
        .iter()
        .rev()
        .zip(new_lines[common_prefix..].iter().rev())
        .take_while(|(a, b)| a == b)
        .count();

    let old_remaining = old_lines.len().saturating_sub(common_prefix + common_suffix);
    let new_remaining = new_lines.len().saturating_sub(common_prefix + common_suffix);

    added = new_remaining;
    removed = old_remaining;

    (added, removed)
}

#[async_trait]
impl MessageHandler for DiffHandler {
    fn name(&self) -> &'static str {
        "DiffHandler"
    }

    async fn handle(&self, event: &ProviderEvent, _ctx: &HandlerContext) -> bool {
        match event {
            ProviderEvent::ToolResult {
                tool_use_id,
                content,
                is_error: _,
            } => {
                // 检查是否是文件编辑工具的结果
                // 这里只记录日志，实际的 Diff 生成需要读取文件前后内容
                if !content.is_empty() {
                    // 检查内容是否包含 diff 标记
                    if content.contains("+++") || content.contains("---") {
                        // 这是一个 diff 结果
                        let _ = tool_use_id; // 可用于关联
                    }
                }
                false
            }
            _ => false,
        }
    }
}

// ─── Y1 增强：行级 diff + 文件对比 ─────────────────────────────────────────────

use std::fs;
use std::path::Path;

/// Diff 片段
#[derive(Debug, Clone, serde::Serialize, PartialEq)]
pub struct DiffHunk {
    pub old_start: usize,
    pub old_count: usize,
    pub new_start: usize,
    pub new_count: usize,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, serde::Serialize, PartialEq)]
pub struct DiffLine {
    pub kind: char, // '+' | '-' | ' '
    pub content: String,
}

/// 统一 Diff 结果
#[derive(Debug, Clone, serde::Serialize)]
pub struct UnifiedDiff {
    pub old_file: String,
    pub new_file: String,
    pub hunks: Vec<DiffHunk>,
    pub additions: usize,
    pub deletions: usize,
}

/// 计算文件的行级 diff（基于 LCS 的简化实现）
pub fn compute_file_diff(
    old_path: &Path,
    new_content: &str,
) -> Result<UnifiedDiff, String> {
    let old_text = if old_path.exists() {
        fs::read_to_string(old_path)
            .map_err(|e| format!("读取旧文件失败: {}", e))?
    } else {
        String::new()
    };

    let old_lines: Vec<&str> = old_text.lines().collect();
    let new_lines: Vec<&str> = new_content.lines().collect();

    // 使用 LCS 计算差异
    let lcs = compute_lcs(&old_lines, &new_lines);
    let hunks = build_hunks(&old_lines, &new_lines, &lcs);

    let (additions, deletions): (usize, usize) = hunks.iter().fold((0, 0), |(a, d), h| {
        let la = h.lines.iter().filter(|l| l.kind == '+').count();
        let ld = h.lines.iter().filter(|l| l.kind == '-').count();
        (a + la, d + ld)
    });

    Ok(UnifiedDiff {
        old_file: old_path.to_string_lossy().to_string(),
        new_file: format!("{} (new)", old_path.to_string_lossy()),
        hunks,
        additions,
        deletions,
    })
}

/// LCS 回溯
fn compute_lcs(a: &[&str], b: &[&str]) -> Vec<bool> {
    let m = a.len();
    let n = b.len();
    let mut dp = vec![vec![0usize; n + 1]; m + 1];

    for i in 1..=m {
        for j in 1..=n {
            if a[i - 1] == b[j - 1] {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = dp[i - 1][j].max(dp[i][j - 1]);
            }
        }
    }

    // 回溯构建匹配标记
    let mut matched = vec![false; m];
    let (mut i, mut j) = (m, n);
    while i > 0 && j > 0 {
        if a[i - 1] == b[j - 1] {
            matched[i - 1] = true;
            i -= 1;
            j -= 1;
        } else if dp[i - 1][j] > dp[i][j - 1] {
            i -= 1;
        } else {
            j -= 1;
        }
    }
    matched
}

/// 构建 diff hunks
fn build_hunks(
    old_lines: &[&str],
    new_lines: &[&str],
    lcs: &[bool],
) -> Vec<DiffHunk> {
    let mut hunks = Vec::new();
    let mut i = 0usize;
    let mut j = 0usize;

    while i < old_lines.len() || j < new_lines.len() {
        let mut old_buf = Vec::new();
        let mut new_buf = Vec::new();
        let old_start = i;
        let new_start = j;

        while i < old_lines.len() || j < new_lines.len() {
            if i < old_lines.len() && j < new_lines.len() && lcs.get(i).copied().unwrap_or(false) && old_lines[i] == new_lines[j] {
                break;
            }
            if i < old_lines.len() && (!lcs.get(i).copied().unwrap_or(false) || j >= new_lines.len()) {
                // 确保不在 LCS 中的旧行才删除
                if !lcs.get(i).copied().unwrap_or(false) || j >= new_lines.len() {
                    old_buf.push(DiffLine { kind: '-', content: old_lines[i].to_string() });
                    i += 1;
                }
            }
            if j < new_lines.len() && (i >= old_lines.len() || old_lines[i] != new_lines[j]) {
                let is_in_lcs = i < old_lines.len() && lcs.get(i).copied().unwrap_or(false) && old_lines[i] == new_lines[j];
                if !is_in_lcs {
                    new_buf.push(DiffLine { kind: '+', content: new_lines[j].to_string() });
                    j += 1;
                }
            }
            // 防止死循环
            if i >= old_lines.len() && j >= new_lines.len() {
                break;
            }
        }

        // 跳过相等行
        while i < old_lines.len() && j < new_lines.len() && old_lines[i] == new_lines[j] {
            i += 1;
            j += 1;
        }

        if !old_buf.is_empty() || !new_buf.is_empty() {
            let mut lines: Vec<DiffLine> = old_buf;
            lines.extend(new_buf);
            hunks.push(DiffHunk {
                old_start: old_start + 1,
                old_count: lines.iter().filter(|l| l.kind == '-').count(),
                new_start: new_start + 1,
                new_count: lines.iter().filter(|l| l.kind == '+').count(),
                lines,
            });
        }
    }

    hunks
}

/// 比较两个文本的差异（内存版本）
pub fn diff_texts(old_text: &str, new_text: &str) -> (usize, usize, String) {
    let old_lines: Vec<&str> = old_text.lines().collect();
    let new_lines: Vec<&str> = new_text.lines().collect();
    let lcs = compute_lcs(&old_lines, &new_lines);
    let hunks = build_hunks(&old_lines, &new_lines, &lcs);

    let mut result = String::new();
    let mut adds = 0usize;
    let mut dels = 0usize;

    for hunk in &hunks {
        for line in &hunk.lines {
            match line.kind {
                '+' => { adds += 1; result.push_str("+ "); }
                '-' => { dels += 1; result.push_str("- "); }
                _ => result.push(' '),
            }
            result.push_str(&line.content);
            result.push('\n');
        }
    }

    (adds, dels, result)
}

// ─── B5-1: 交互式Diff — 接受/拒绝变更块 ───────────────────────────────────────

/// 接受 diff 变更：将 new_content 写入文件
/// hunk_index: 如果为 None，接受整个 diff；否则只接受指定 hunk
#[tauri::command]
pub async fn cc_apply_diff_changes(
    file_path: String,
    old_content: String,
    new_content: String,
    hunk_index: Option<usize>,
) -> Result<serde_json::Value, String> {
    let path = Path::new(&file_path);

    if let Some(hunk_idx) = hunk_index {
        // 只接受指定 hunk：合并 old + 选中的 new hunk
        let old_lines: Vec<&str> = old_content.lines().collect();
        let new_lines: Vec<&str> = new_content.lines().collect();
        let lcs = compute_lcs(&old_lines, &new_lines);
        let hunks = build_hunks(&old_lines, &new_lines, &lcs);

        if hunk_idx >= hunks.len() {
            return Err(format!("hunk_index {} out of range ({} hunks)", hunk_idx, hunks.len()));
        }

        let mut result_lines: Vec<String> = Vec::new();
        let mut old_pos = 0usize;
        let target_hunk = &hunks[hunk_idx];

        // 复制 hunk 之前的所有旧行
        while old_pos < target_hunk.old_start.saturating_sub(1) {
            if old_pos < old_lines.len() {
                result_lines.push(old_lines[old_pos].to_string());
            }
            old_pos += 1;
        }

        // 应用目标 hunk 的新行
        for line in &target_hunk.lines {
            match line.kind {
                '+' => result_lines.push(line.content.clone()),
                '-' => { old_pos += 1; } // 跳过删除行
                ' ' => {
                    result_lines.push(line.content.clone());
                    old_pos += 1;
                }
                _ => {}
            }
        }

        // 跳过目标 hunk 的剩余旧行
        old_pos += target_hunk.old_count;

        // 复制 hunk 之后的所有旧行
        while old_pos < old_lines.len() {
            result_lines.push(old_lines[old_pos].to_string());
            old_pos += 1;
        }

        let merged = result_lines.join("\n");
        fs::write(path, &merged)
            .map_err(|e| format!("写入文件失败: {}", e))?;

        Ok(serde_json::json!({
            "accepted": true,
            "hunk_index": hunk_idx,
            "total_hunks": hunks.len(),
            "file": file_path,
            "partial": true,
        }))
    } else {
        // 接受整个 diff：直接写入 new_content
        fs::write(path, &new_content)
            .map_err(|e| format!("写入文件失败: {}", e))?;

        let old_lines = old_content.lines().count();
        let new_lines_count = new_content.lines().count();

        Ok(serde_json::json!({
            "accepted": true,
            "hunk_index": null,
            "total_hunks": null,
            "file": file_path,
            "partial": false,
            "old_lines": old_lines,
            "new_lines": new_lines_count,
        }))
    }
}

/// 拒绝 diff 变更：保持原文件不变
#[tauri::command]
pub async fn cc_reject_diff_changes(
    file_path: String,
) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "rejected": true,
        "file": file_path,
    }))
}

#[cfg(test)]
mod diff_tests {
    use super::*;

    #[test]
    fn test_compute_lcs() {
        let a = vec!["a", "b", "c"];
        let b = vec!["a", "b", "c"];
        let lcs = compute_lcs(&a, &b);
        assert_eq!(lcs.iter().filter(|x| **x).count(), 3);
    }

    #[test]
    fn test_diff_texts_same() {
        let (adds, dels, _) = diff_texts("hello\nworld", "hello\nworld");
        assert_eq!(adds, 0);
        assert_eq!(dels, 0);
    }

    #[test]
    fn test_diff_texts_changed() {
        let (adds, dels, result) = diff_texts("hello\nworld", "hello\nrust");
        assert!(adds > 0 || dels > 0);
        assert!(result.contains("rust") || result.contains("world"));
    }

    #[test]
    fn test_compute_file_diff() {
        use std::fs;
        let dir = std::env::temp_dir().join("test_diff");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let file = dir.join("test.txt");
        fs::write(&file, "line1\nline2\nline3").unwrap();

        let result = compute_file_diff(&file, "line1\nline2_modified\nline4");
        assert!(result.is_ok());
        let diff = result.unwrap();
        assert!(diff.additions > 0 || diff.deletions > 0);

        let _ = fs::remove_dir_all(&dir);
    }
}
