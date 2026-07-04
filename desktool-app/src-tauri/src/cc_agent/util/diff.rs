// util/diff.rs — 简单 diff 算法工具
// 对齐 cc-gui handler/diff 中的行级 diff 逻辑

/// 单个 diff 操作
#[derive(Debug, Clone, PartialEq)]
pub enum DiffOp {
    Keep(String),
    Insert(String),
    Delete(String),
    Replace(String, String),
}

/// 行级 diff（最长公共子序列算法）
pub fn line_diff(old_lines: &[&str], new_lines: &[&str]) -> Vec<DiffOp> {
    let lcs = compute_lcs(old_lines, new_lines);
    let mut ops = Vec::new();
    let mut oi = 0;
    let mut ni = 0;
    let mut li = 0;

    while oi < old_lines.len() || ni < new_lines.len() {
        if li < lcs.len() && oi < old_lines.len() && old_lines[oi] == lcs[li] {
            if ni < new_lines.len() && new_lines[ni] == lcs[li] {
                ops.push(DiffOp::Keep(lcs[li].to_string()));
                oi += 1;
                ni += 1;
                li += 1;
            } else {
                ops.push(DiffOp::Insert(new_lines[ni].to_string()));
                ni += 1;
            }
        } else if li < lcs.len() && ni < new_lines.len() && new_lines[ni] == lcs[li] {
            ops.push(DiffOp::Delete(old_lines[oi].to_string()));
            oi += 1;
        } else {
            // 既有删除又有插入 → replace
            if oi < old_lines.len() && ni < new_lines.len() {
                ops.push(DiffOp::Replace(
                    old_lines[oi].to_string(),
                    new_lines[ni].to_string(),
                ));
                oi += 1;
                ni += 1;
            } else if oi < old_lines.len() {
                ops.push(DiffOp::Delete(old_lines[oi].to_string()));
                oi += 1;
            } else if ni < new_lines.len() {
                ops.push(DiffOp::Insert(new_lines[ni].to_string()));
                ni += 1;
            }
        }
    }

    ops
}

/// 计算 LCS（最长公共子序列）
fn compute_lcs(a: &[&str], b: &[&str]) -> Vec<String> {
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

    // 回溯
    let mut result = Vec::new();
    let (mut i, mut j) = (m, n);
    while i > 0 && j > 0 {
        if a[i - 1] == b[j - 1] {
            result.push(a[i - 1].to_string());
            i -= 1;
            j -= 1;
        } else if dp[i - 1][j] > dp[i][j - 1] {
            i -= 1;
        } else {
            j -= 1;
        }
    }
    result.reverse();
    result
}

/// 统计 diff 变更
pub struct DiffStats {
    pub added: usize,
    pub deleted: usize,
    pub unchanged: usize,
}

/// 统计 diff 操作
pub fn count_diff_stats(ops: &[DiffOp]) -> DiffStats {
    let mut stats = DiffStats { added: 0, deleted: 0, unchanged: 0 };
    for op in ops {
        match op {
            DiffOp::Keep(_) => stats.unchanged += 1,
            DiffOp::Insert(_) => stats.added += 1,
            DiffOp::Delete(_) => stats.deleted += 1,
            DiffOp::Replace(_, _) => {
                stats.deleted += 1;
                stats.added += 1;
            }
        }
    }
    stats
}

/// 生成统一 diff 格式（简化版）
pub fn to_unified_diff(old_lines: &[&str], new_lines: &[&str], old_name: &str, new_name: &str) -> String {
    let ops = line_diff(old_lines, new_lines);
    let mut result = format!("--- {}\n+++ {}\n", old_name, new_name);

    for op in &ops {
        match op {
            DiffOp::Keep(line) => {
                result.push_str(&format!("  {}\n", line));
            }
            DiffOp::Insert(line) => {
                result.push_str(&format!("+{}\n", line));
            }
            DiffOp::Delete(line) => {
                result.push_str(&format!("-{}\n", line));
            }
            DiffOp::Replace(old, new) => {
                result.push_str(&format!("-{}\n", old));
                result.push_str(&format!("+{}\n", new));
            }
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_line_diff_same() {
        let old = &["a", "b", "c"];
        let new = &["a", "b", "c"];
        let ops = line_diff(old, new);
        assert!(ops.iter().all(|op| matches!(op, DiffOp::Keep(_))));
    }

    #[test]
    fn test_line_diff_insert() {
        let old = &["a", "c"];
        let new = &["a", "b", "c"];
        let ops = line_diff(old, new);
        assert!(ops.iter().any(|op| matches!(op, DiffOp::Insert(_))));
    }

    #[test]
    fn test_line_diff_delete() {
        let old = &["a", "b", "c"];
        let new = &["a", "c"];
        let ops = line_diff(old, new);
        assert!(ops.iter().any(|op| matches!(op, DiffOp::Delete(_))));
    }

    #[test]
    fn test_diff_stats() {
        let old = &["keep", "remove", "modify"];
        let new = &["keep", "modified", "added"];
        let ops = line_diff(old, new);
        let stats = count_diff_stats(&ops);
        assert!(stats.added > 0 || stats.deleted > 0);
    }

    #[test]
    fn test_unified_diff() {
        let old = &["hello", "world"];
        let new = &["hello", "rust"];
        let diff = to_unified_diff(old, new, "old.txt", "new.txt");
        assert!(diff.contains("--- old.txt"));
        assert!(diff.contains("+++ new.txt"));
        assert!(diff.contains("+rust"));
        assert!(diff.contains("-world"));
    }
}
