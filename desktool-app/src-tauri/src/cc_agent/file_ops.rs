// file_ops.rs — 文件操作（列表/读取/diff/撤销）
// Sprint L: 从 cc_agent.rs 拆分

use super::types::FileEntry;

/// List files in a directory (for @file autocomplete)
#[tauri::command]
pub async fn cc_list_files(
    dir: String,
    query: String,
) -> Result<Vec<FileEntry>, String> {
    let mut results = Vec::new();
    let base = std::path::Path::new(&dir);
    if !base.exists() {
        return Ok(results);
    }

    let query_lower = query.to_lowercase();
    collect_files(base, &query_lower, &mut results, 0, 100);

    Ok(results)
}

/// List immediate children of a directory (for file tree lazy loading)
#[tauri::command]
pub async fn cc_list_dir_children(
    dir: String,
) -> Result<Vec<super::handler::file::FileTreeNode>, String> {
    let path = std::path::Path::new(&dir);
    if !path.is_dir() {
        return Ok(vec![]);
    }
    let mut children = Vec::new();
    let entries = match std::fs::read_dir(path) {
        Ok(e) => e,
        Err(e) => return Err(e.to_string()),
    };
    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "node_modules" || name == "target" || name == "__pycache__" {
            continue;
        }
        let is_dir = entry.path().is_dir();
        let size = if is_dir { 0 } else { entry.metadata().map(|m| m.len()).unwrap_or(0) };
        children.push(super::handler::file::FileTreeNode {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir,
            size,
            children: vec![],
        });
    }
    children.sort_by(|a, b| {
        if a.is_dir != b.is_dir { return if a.is_dir { std::cmp::Ordering::Less } else { std::cmp::Ordering::Greater }; }
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    });
    Ok(children)
}

fn collect_files(dir: &std::path::Path, query: &str, results: &mut Vec<FileEntry>, depth: usize, max: usize) {
    if depth > 5 || results.len() >= max {
        return;
    }

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries {
        if results.len() >= max {
            return;
        }
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') || name == "node_modules" || name == "target" || name == "__pycache__" {
            continue;
        }

        let is_dir = path.is_dir();
        let name_lower = name.to_lowercase();

        if query.is_empty() || name_lower.contains(query) {
            let rel = path.strip_prefix(dir.parent().unwrap_or(dir))
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();
            results.push(FileEntry {
                path: rel,
                full_path: path.to_string_lossy().to_string(),
                is_dir,
                size: entry.metadata().map(|m| m.len()).unwrap_or(0),
            });
        }

        if is_dir {
            collect_files(&path, query, results, depth + 1, max);
        }
    }
}

/// Read a file's content (for @file reference)
#[tauri::command]
pub async fn cc_read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Phase 9: 获取文件 diff（基于 git）
#[tauri::command]
pub async fn cc_get_file_diff(
    file_path: String,
    cwd: String,
) -> Result<serde_json::Value, String> {
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err(format!("文件不存在: {}", file_path));
    }

    let output = std::process::Command::new("git")
        .args(["diff", "HEAD", "--"])
        .arg(&file_path)
        .current_dir(&cwd)
        .output()
        .map_err(|e| format!("git 执行失败: {}", e))?;

    let diff_text = String::from_utf8_lossy(&output.stdout).to_string();
    let has_changes = !diff_text.is_empty();

    let content = std::fs::read_to_string(&file_path).unwrap_or_default();
    let preview: String = content.lines().take(100).collect::<Vec<_>>().join("\n");

    Ok(serde_json::json!({
        "filePath": file_path,
        "diff": diff_text,
        "hasChanges": has_changes,
        "preview": preview,
        "size": content.len(),
    }))
}

/// Phase 9: 撤销文件变更（基于 git checkout）
#[tauri::command]
pub async fn cc_undo_file(
    file_path: String,
    cwd: String,
) -> Result<serde_json::Value, String> {
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err(format!("文件不存在: {}", file_path));
    }

    let output = std::process::Command::new("git")
        .args(["checkout", "HEAD", "--"])
        .arg(&file_path)
        .current_dir(&cwd)
        .output()
        .map_err(|e| format!("git 执行失败: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("撤销失败: {}", err));
    }

    Ok(serde_json::json!({
        "success": true,
        "filePath": file_path,
        "message": "已恢复到 HEAD 版本",
    }))
}

/// Phase 9: 撤销所有文件变更（git checkout -- .）
#[tauri::command]
pub async fn cc_discard_all_files(
    cwd: String,
) -> Result<serde_json::Value, String> {
    let output = std::process::Command::new("git")
        .args(["checkout", "HEAD", "--", "."])
        .current_dir(&cwd)
        .output()
        .map_err(|e| format!("git 执行失败: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("撤销失败: {}", err));
    }

    Ok(serde_json::json!({
        "success": true,
        "message": "已恢复所有文件到 HEAD 版本",
    }))
}
