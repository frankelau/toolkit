// util/paths.rs — 路径工具
// 对齐 cc-gui PathUtils + WslPathUtil

use std::path::{Path, PathBuf};

/// 规范化路径（解析 . 和 ..）
pub fn normalize(path: &Path) -> PathBuf {
    let mut components = Vec::new();
    for component in path.components() {
        match component {
            std::path::Component::CurDir => {}
            std::path::Component::ParentDir => {
                components.pop();
            }
            c => components.push(c),
        }
    }
    if components.is_empty() {
        PathBuf::from(".")
    } else {
        components.iter().collect()
    }
}

/// 判断子路径是否是父路径的子目录
pub fn is_child(parent: &Path, child: &Path) -> bool {
    let parent = normalize(parent);
    let child = normalize(child);
    child.starts_with(&parent)
}

/// 安全的路径拼接（防止路径穿越）
pub fn safe_join(base: &Path, name: &str) -> Option<PathBuf> {
    if name.contains("..") || name.contains('/') || name.contains('\\') {
        return None;
    }
    let joined = base.join(name);
    let normalized = normalize(&joined);
    let base_normalized = normalize(base);
    if normalized.starts_with(&base_normalized) {
        Some(normalized)
    } else {
        None
    }
}

/// 判断是否为绝对路径
pub fn is_absolute(path: &str) -> bool {
    Path::new(path).is_absolute()
}

/// 获取项目名称（从路径的最后一段）
pub fn project_name(path: &Path) -> Option<String> {
    path.file_name()
        .map(|n| n.to_string_lossy().to_string())
}

/// 路径哈希（用于生成唯一目录名）
pub fn path_hash(path: &str) -> String {
    let mut hash: u64 = 0;
    for b in path.as_bytes() {
        hash = hash.wrapping_mul(31).wrapping_add(*b as u64);
    }
    format!("{:x}", hash)
}

/// 展开 ~ 为 home 目录
pub fn expand_tilde(path: &str) -> Option<PathBuf> {
    if path.starts_with("~/") || path == "~" {
        let home = dirs::home_dir()?;
        if path == "~" {
            Some(home)
        } else {
            Some(home.join(&path[2..]))
        }
    } else {
        Some(PathBuf::from(path))
    }
}

/// 缩短路径显示（~/.../last_component）
pub fn short_path(path: &Path, max_components: usize) -> String {
    let home = dirs::home_dir();
    let display = if let Some(ref home) = home {
        if let Ok(rest) = path.strip_prefix(home) {
            format!("~/{}", rest.display())
        } else {
            path.display().to_string()
        }
    } else {
        path.display().to_string()
    };

    let components: Vec<&str> = display.split('/').collect();
    if components.len() <= max_components {
        display
    } else {
        let mut result = String::new();
        let keep_end = max_components / 2;
        for (i, c) in components.iter().enumerate() {
            if i == 0 {
                result.push_str(c);
            } else if i < components.len() - keep_end {
                if i == 1 {
                    result.push_str("/...");
                }
            } else {
                result.push('/');
                result.push_str(c);
            }
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize() {
        let p = Path::new("/foo/bar/../baz/./qux");
        assert_eq!(normalize(p), PathBuf::from("/foo/baz/qux"));
    }

    #[test]
    fn test_is_child() {
        let parent = Path::new("/home/user/project");
        let child = Path::new("/home/user/project/src/main.rs");
        assert!(is_child(parent, child));
        assert!(!is_child(parent, Path::new("/home/user/other")));
    }

    #[test]
    fn test_safe_join() {
        let base = Path::new("/home/user");
        assert!(safe_join(base, "projects").is_some());
        assert!(safe_join(base, "../etc").is_none());
        assert!(safe_join(base, "a/b").is_none());
    }

    #[test]
    fn test_expand_tilde() {
        let result = expand_tilde("~/Documents");
        assert!(result.is_some());
        let result = expand_tilde("/absolute/path");
        assert_eq!(result, Some(PathBuf::from("/absolute/path")));
    }

    #[test]
    fn test_path_hash() {
        let h1 = path_hash("/home/user/project");
        let h2 = path_hash("/home/user/project");
        assert_eq!(h1, h2);
    }
}
