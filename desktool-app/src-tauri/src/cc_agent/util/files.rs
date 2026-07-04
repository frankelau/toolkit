// util/files.rs — 文件操作工具
// 对齐 cc-gui EditorFileUtils + 通用文件操作

use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

/// 递归创建目录
pub fn ensure_dir(path: &Path) -> io::Result<()> {
    if !path.exists() {
        fs::create_dir_all(path)?;
    }
    Ok(())
}

/// 安全读取文件（字符串）
pub fn read_file(path: &Path) -> io::Result<String> {
    fs::read_to_string(path)
}

/// 安全读取文件（字节）
pub fn read_bytes(path: &Path) -> io::Result<Vec<u8>> {
    fs::read(path)
}

/// 安全写入文件（字符串）
pub fn write_file(path: &Path, content: &str) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    fs::write(path, content)
}

/// 安全写入文件（字节）
pub fn write_bytes(path: &Path, content: &[u8]) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    fs::write(path, content)
}

/// 递归复制目录
pub fn copy_dir(src: &Path, dst: &Path) -> io::Result<()> {
    ensure_dir(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

/// 递归删除目录
pub fn remove_dir(path: &Path) -> io::Result<()> {
    if path.exists() {
        fs::remove_dir_all(path)?;
    }
    Ok(())
}

/// 复制文件（确保目标目录存在）
pub fn copy_file(src: &Path, dst: &Path) -> io::Result<()> {
    if let Some(parent) = dst.parent() {
        ensure_dir(parent)?;
    }
    fs::copy(src, dst)?;
    Ok(())
}

/// 移动文件/目录（跨文件系统自动降级为 copy+delete）
pub fn move_entry(src: &Path, dst: &Path) -> io::Result<()> {
    match fs::rename(src, dst) {
        Ok(()) => Ok(()),
        Err(_) => {
            // 跨文件系统降级
            if src.is_dir() {
                copy_dir(src, dst)?;
                remove_dir(src)?;
            } else {
                copy_file(src, dst)?;
                fs::remove_file(src)?;
            }
            Ok(())
        }
    }
}

/// 列出目录内容（仅文件名）
pub fn list_names(path: &Path) -> io::Result<Vec<String>> {
    let mut names = Vec::new();
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        names.push(entry.file_name().to_string_lossy().to_string());
    }
    names.sort();
    Ok(names)
}

/// 判断文件是否存在且为常规文件
pub fn is_file(path: &Path) -> bool {
    path.is_file()
}

/// 判断路径是否存在
pub fn exists(path: &Path) -> bool {
    path.exists()
}

/// 获取文件大小（字节）
pub fn file_size(path: &Path) -> io::Result<u64> {
    fs::metadata(path).map(|m| m.len())
}

/// 按行读取文件
pub fn read_lines(path: &Path) -> io::Result<Vec<String>> {
    let content = fs::read_to_string(path)?;
    Ok(content.lines().map(|l| l.to_string()).collect())
}

/// 追加写入文件
pub fn append_file(path: &Path, content: &str) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    let mut file = fs::OpenOptions::new().append(true).create(true).open(path)?;
    file.write_all(content.as_bytes())?;
    Ok(())
}

/// 创建临时目录并返回路径（自动清理）
pub fn with_temp_dir<F, T>(prefix: &str, f: F) -> io::Result<T>
where
    F: FnOnce(&Path) -> io::Result<T>,
{
    let dir = std::env::temp_dir().join(format!("{}_{}", prefix, uuid::Uuid::new_v4()));
    ensure_dir(&dir)?;
    let result = f(&dir);
    let _ = remove_dir(&dir);
    result
}

/// 递归计算目录大小
pub fn dir_size(path: &Path) -> io::Result<u64> {
    let mut total = 0u64;
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let meta = entry.metadata()?;
        if meta.is_file() {
            total += meta.len();
        } else if meta.is_dir() {
            total += dir_size(&entry.path())?;
        }
    }
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ensure_dir() {
        let dir = std::env::temp_dir().join("test_ensure_dir");
        let _ = remove_dir(&dir);
        ensure_dir(&dir).unwrap();
        assert!(dir.exists());
        let _ = remove_dir(&dir);
    }

    #[test]
    fn test_write_read() {
        let dir = std::env::temp_dir().join("test_write_read");
        let _ = remove_dir(&dir);
        ensure_dir(&dir).unwrap();
        let file = dir.join("test.txt");
        write_file(&file, "hello world").unwrap();
        assert_eq!(read_file(&file).unwrap(), "hello world");
        let _ = remove_dir(&dir);
    }

    #[test]
    fn test_copy_dir() {
        let dir = std::env::temp_dir().join("test_copy");
        let _ = remove_dir(&dir);
        let src = dir.join("src").join("sub");
        ensure_dir(&src).unwrap();
        write_file(&src.join("f.txt"), "data").unwrap();

        let dst = dir.join("dst");
        copy_dir(&dir.join("src"), &dst).unwrap();
        assert!(dst.join("sub").join("f.txt").exists());
        let _ = remove_dir(&dir);
    }

    #[test]
    fn test_move_cross_fs() {
        // 在同一临时目录内测试（跨目录移动）
        let dir = std::env::temp_dir().join("test_move");
        let _ = remove_dir(&dir);
        let src_dir = dir.join("src");
        let dst_dir = dir.join("dst");
        ensure_dir(&src_dir).unwrap();
        write_file(&src_dir.join("m.txt"), "move").unwrap();

        move_entry(&src_dir.join("m.txt"), &dst_dir.join("m.txt")).unwrap();
        assert!(dst_dir.join("m.txt").exists());
        assert!(!src_dir.join("m.txt").exists());
        let _ = remove_dir(&dir);
    }
}
