// util/platform.rs — 平台检测工具
// 对齐 cc-gui PlatformUtils

/// 操作系统类型
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Os {
    Windows,
    MacOS,
    Linux,
    Unknown,
}

/// 获取当前操作系统
pub fn current_os() -> Os {
    if cfg!(target_os = "windows") {
        Os::Windows
    } else if cfg!(target_os = "macos") {
        Os::MacOS
    } else if cfg!(target_os = "linux") {
        Os::Linux
    } else {
        Os::Unknown
    }
}

/// 获取操作系统名称
pub fn os_name() -> &'static str {
    std::env::consts::OS
}

/// 获取 CPU 架构
pub fn arch() -> &'static str {
    std::env::consts::ARCH
}

/// 判断是否为 Windows
pub fn is_windows() -> bool {
    cfg!(target_os = "windows")
}

/// 判断是否为 macOS
pub fn is_macos() -> bool {
    cfg!(target_os = "macos")
}

/// 判断是否为 Linux
pub fn is_linux() -> bool {
    cfg!(target_os = "linux")
}

/// 获取系统临时目录
pub fn temp_dir() -> std::path::PathBuf {
    std::env::temp_dir()
}

/// 获取用户主目录
pub fn home_dir() -> Option<std::path::PathBuf> {
    dirs::home_dir()
}

/// 获取可执行文件扩展名
pub fn exe_extension() -> &'static str {
    if cfg!(target_os = "windows") {
        ".exe"
    } else {
        ""
    }
}

/// 路径分隔符
pub fn path_separator() -> char {
    if cfg!(target_os = "windows") { ';' } else { ':' }
}

/// 换行符
pub fn line_ending() -> &'static str {
    if cfg!(target_os = "windows") { "\r\n" } else { "\n" }
}

/// 环境变量名规范化（Windows 不分大小写）
pub fn normalize_env_key(key: &str) -> String {
    if cfg!(target_os = "windows") {
        key.to_uppercase()
    } else {
        key.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_os_detection() {
        let os = current_os();
        match os {
            Os::MacOS => assert!(is_macos()),
            Os::Windows => assert!(is_windows()),
            Os::Linux => assert!(is_linux()),
            _ => {}
        }
    }

    #[test]
    fn test_exe_extension() {
        if is_windows() {
            assert_eq!(exe_extension(), ".exe");
        } else {
            assert_eq!(exe_extension(), "");
        }
    }
}
