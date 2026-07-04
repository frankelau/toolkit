// handler/file.rs — 文件操作 handler
// Sprint S2: 处理文件相关的 Provider 事件（Read/Write/Edit 工具调用）

use async_trait::async_trait;

use crate::cc_agent::handler::{
    FileChangeRecord, FileChangeType, HandlerContext, MessageHandler,
};
use crate::cc_agent::provider::ProviderEvent;

/// 文件操作 Handler
///
/// 监听 ToolUse 事件，识别文件操作工具（Read/Write/Edit），
/// 记录文件变更到 HandlerContext。
pub struct FileHandler;

impl FileHandler {
    pub fn new() -> Self {
        Self
    }
}

impl Default for FileHandler {
    fn default() -> Self {
        Self::new()
    }
}

/// 文件操作工具名集合
const FILE_WRITE_TOOLS: &[&str] = &[
    "write", "write_file", "edit", "edit_file",
    "replace_string", "write_to_file", "create_file", "notebookedit",
];

const FILE_DELETE_TOOLS: &[&str] = &[
    "delete_file", "remove_file", "rm",
];

/// 从工具输入中提取文件路径
fn extract_file_path(tool_name: &str, input: &serde_json::Value) -> Option<String> {
    let normalized = tool_name.to_lowercase();
    let candidates = ["file_path", "path", "target_file", "notebook_path", "filePath"];
    for key in &candidates {
        if let Some(path) = input.get(*key).and_then(|v| v.as_str()) {
            return Some(path.to_string());
        }
    }
    // 对于 bash 工具，尝试从 command 中提取
    if normalized == "bash" || normalized == "shell_command" {
        if let Some(cmd) = input.get("command").and_then(|v| v.as_str()) {
            // 简单提取：cat > file, tee file, echo > file
            if let Some(path) = extract_path_from_redirect(cmd) {
                return Some(path);
            }
        }
    }
    None
}

fn extract_path_from_redirect(cmd: &str) -> Option<String> {
    // cat > file.txt
    if let Some(idx) = cmd.find('>') {
        let after = cmd[idx + 1..].trim();
        if !after.is_empty() {
            return Some(after.split_whitespace().next()?.to_string());
        }
    }
    None
}

#[async_trait]
impl MessageHandler for FileHandler {
    fn name(&self) -> &'static str {
        "FileHandler"
    }

    async fn handle(&self, event: &ProviderEvent, ctx: &HandlerContext) -> bool {
        match event {
            ProviderEvent::ToolUse { id, name, input } => {
                let normalized = name.to_lowercase();

                let change_type = if FILE_WRITE_TOOLS.contains(&normalized.as_str()) {
                    // 区分新建 vs 修改需要读取文件是否存在，这里简化为 Modified
                    Some(FileChangeType::Modified)
                } else if FILE_DELETE_TOOLS.contains(&normalized.as_str()) {
                    Some(FileChangeType::Deleted)
                } else if normalized == "bash" || normalized == "shell_command" {
                    // bash 工具可能做任何操作，检查是否有重定向
                    if let Some(cmd) = input.get("command").and_then(|v| v.as_str()) {
                        if cmd.contains('>') {
                            Some(FileChangeType::Modified)
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                };

                if let Some(ct) = change_type {
                    if let Some(path) = extract_file_path(name, input) {
                        ctx.record_file_change(FileChangeRecord {
                            path,
                            change_type: ct,
                            tool_use_id: id.clone(),
                            timestamp: std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .map(|d| d.as_secs())
                                .unwrap_or(0),
                        })
                        .await;
                    }
                }

                // FileHandler 不阻止后续 handler 处理
                false
            }
            _ => false,
        }
    }
}

// ─── Y1 增强：文件列表 + 忽略规则 + 内容读取 ────────────────────────────────────

use std::fs;
use std::path::{Path, PathBuf};

/// 文件树节点
#[derive(Debug, Clone, serde::Serialize)]
pub struct FileTreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub children: Vec<FileTreeNode>,
}

/// 默认忽略模式（对齐 .gitignore 常见项）
const DEFAULT_IGNORE: &[&str] = &[
    "node_modules", ".git", ".idea", ".vscode",
    "__pycache__", "*.pyc", ".DS_Store", "target",
    "dist", "build", ".next", ".cache", "*.log",
];

/// 构建文件树
///
/// # Arguments
/// * `root` - 根目录
/// * `max_depth` - 最大深度（None = 不限制）
/// * `ignore_patterns` - 额外的忽略 glob 模式
pub fn build_file_tree(
    root: &Path,
    max_depth: Option<usize>,
    ignore_patterns: &[String],
) -> FileTreeNode {
    let name = root
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| root.to_string_lossy().to_string());

    FileTreeNode {
        name,
        path: root.to_string_lossy().to_string(),
        is_dir: root.is_dir(),
        size: 0,
        children: if root.is_dir() {
            build_children(root, 0, max_depth, ignore_patterns)
        } else {
            vec![]
        },
    }
}

fn build_children(
    dir: &Path,
    current_depth: usize,
    max_depth: Option<usize>,
    ignore_patterns: &[String],
) -> Vec<FileTreeNode> {
    if let Some(max) = max_depth {
        if current_depth >= max {
            return vec![];
        }
    }

    let mut children = Vec::new();
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return children,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // 检查是否应忽略
        if should_ignore(&name, ignore_patterns) {
            continue;
        }

        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let mut node = FileTreeNode {
            name: name.clone(),
            path: path.to_string_lossy().to_string(),
            is_dir: meta.is_dir(),
            size: meta.len(),
            children: vec![],
        };

        if meta.is_dir() {
            node.children = build_children(&path, current_depth + 1, max_depth, ignore_patterns);
        }

        children.push(node);
    }

    // 按目录优先、字母排序
    children.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    children
}

/// 检查是否应忽略
fn should_ignore(name: &str, extra_patterns: &[String]) -> bool {
    // 隐藏文件
    if name.starts_with('.') {
        return true;
    }

    // 默认忽略
    for pattern in DEFAULT_IGNORE {
        if simple_pattern_match(pattern, name) {
            return true;
        }
    }

    // 额外忽略
    for pattern in extra_patterns {
        if simple_pattern_match(pattern, name) {
            return true;
        }
    }

    false
}

/// 简单 glob 匹配（支持 * 前缀/后缀/前后缀通配）
fn simple_pattern_match(pattern: &str, name: &str) -> bool {
    if !pattern.contains('*') {
        return name == pattern;
    }
    // *suffix → ends with
    if pattern.starts_with('*') && !pattern[1..].contains('*') {
        return name.ends_with(&pattern[1..]);
    }
    // prefix* → starts with  
    if pattern.ends_with('*') && !pattern[..pattern.len()-1].contains('*') {
        return name.starts_with(&pattern[..pattern.len()-1]);
    }
    // *mid*suffix → contains mid and ends with suffix
    if pattern.starts_with('*') && pattern.ends_with('*') && !pattern[1..pattern.len()-1].contains('*') {
        let inner = &pattern[1..pattern.len()-1];
        return name.contains(inner);
    }
    // prefix* → starts with (fallback)
    let prefix = pattern.trim_end_matches('*');
    name.starts_with(prefix)
}

/// 读取文件内容（带行数限制）
pub fn read_file_content(path: &Path, max_lines: Option<usize>) -> Result<String, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("读取文件失败 {}: {}", path.display(), e))?;
    match max_lines {
        Some(max) => {
            let lines: Vec<&str> = content.lines().collect();
            if lines.len() <= max {
                Ok(content)
            } else {
                Ok(format!(
                    "{}\n... (共 {} 行，仅显示前 {} 行)",
                    lines[..max].join("\n"),
                    lines.len(),
                    max
                ))
            }
        }
        None => Ok(content),
    }
}

/// 列出目录文件（扁平列表，带忽略规则）
pub fn list_directory_files(dir: &Path, ignore_patterns: &[String]) -> Vec<String> {
    let mut files = Vec::new();
    if !dir.is_dir() {
        return files;
    }
    list_files_recursive(dir, dir, ignore_patterns, &mut files);
    files.sort();
    files
}

fn list_files_recursive(
    base: &Path,
    current: &Path,
    ignore_patterns: &[String],
    files: &mut Vec<String>,
) {
    let entries = match fs::read_dir(current) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if should_ignore(&name, ignore_patterns) {
            continue;
        }

        if path.is_dir() {
            list_files_recursive(base, &path, ignore_patterns, files);
        } else if path.is_file() {
            if let Ok(rel) = path.strip_prefix(base) {
                files.push(rel.to_string_lossy().to_string());
            }
        }
    }
}

/// 统计文件信息
#[derive(Debug, Clone, serde::Serialize)]
pub struct FileStats {
    pub total_files: usize,
    pub total_dirs: usize,
    pub total_size: u64,
    pub by_extension: std::collections::HashMap<String, usize>,
}

pub fn get_directory_stats(dir: &Path, ignore_patterns: &[String]) -> FileStats {
    let mut stats = FileStats {
        total_files: 0,
        total_dirs: 0,
        total_size: 0,
        by_extension: std::collections::HashMap::new(),
    };
    collect_stats(dir, ignore_patterns, &mut stats);
    stats
}

fn collect_stats(
    dir: &Path,
    ignore_patterns: &[String],
    stats: &mut FileStats,
) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if should_ignore(&name, ignore_patterns) {
            continue;
        }

        if path.is_dir() {
            stats.total_dirs += 1;
            collect_stats(&path, ignore_patterns, stats);
        } else if path.is_file() {
            stats.total_files += 1;
            if let Ok(size) = entry.metadata().map(|m| m.len()) {
                stats.total_size += size;
            }
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                *stats.by_extension.entry(ext.to_lowercase()).or_default() += 1;
            }
        }
    }
}

#[cfg(test)]
mod file_tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_extract_file_path_write() {
        let input = serde_json::json!({"file_path": "/src/main.rs", "content": "hello"});
        assert_eq!(
            extract_file_path("Write", &input),
            Some("/src/main.rs".to_string())
        );
    }

    #[test]
    fn test_simple_pattern_match() {
        assert!(simple_pattern_match("*.log", "error.log"));
        assert!(simple_pattern_match("node_modules", "node_modules"));
        assert!(!simple_pattern_match("*.rs", "main.ts"));
    }

    #[test]
    fn test_build_file_tree() {
        let dir = std::env::temp_dir().join("test_tree");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("src")).unwrap();
        fs::write(dir.join("src").join("main.ts"), "test").unwrap();

        let tree = build_file_tree(&dir, Some(2), &[]);
        assert_eq!(tree.name, dir.file_name().unwrap().to_string_lossy().to_string());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_list_directory_files() {
        let dir = std::env::temp_dir().join("test_list");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("sub")).unwrap();
        fs::write(dir.join("a.txt"), "a").unwrap();
        fs::write(dir.join("sub").join("b.txt"), "b").unwrap();

        let files = list_directory_files(&dir, &[]);
        assert!(files.iter().any(|f| f.contains("a.txt")));
        assert!(files.iter().any(|f| f.contains("b.txt")));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_directory_stats() {
        let dir = std::env::temp_dir().join("test_stats");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("main.rs"), "hello world").unwrap();
        fs::write(dir.join("lib.rs"), "pub fn test() {}").unwrap();

        let stats = get_directory_stats(&dir, &[]);
        assert_eq!(stats.total_files, 2);
        assert!(stats.by_extension.contains_key("rs"));

        let _ = fs::remove_dir_all(&dir);
    }
}
