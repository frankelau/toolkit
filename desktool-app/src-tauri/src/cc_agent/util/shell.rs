// util/shell.rs — 命令执行工具
// 对齐 cc-gui ShellExecutor

use std::process::{Command, Output};
use std::time::Duration;

/// 同步执行命令并获取输出
pub fn exec(program: &str, args: &[&str]) -> Result<Output, String> {
    Command::new(program)
        .args(args)
        .output()
        .map_err(|e| format!("执行 {} 失败: {}", program, e))
}

/// 执行命令并获取 stdout 字符串
pub fn exec_stdout(program: &str, args: &[&str]) -> Result<String, String> {
    let output = exec(program, args)?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("{} 失败 (exit {}): {}", program, output.status, stderr.trim()))
    }
}

/// 同步执行，设置工作目录
pub fn exec_in_dir(program: &str, args: &[&str], cwd: &str) -> Result<Output, String> {
    Command::new(program)
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("执行 {} 失败: {}", program, e))
}

/// 静默执行（不关心输出，只关心成功与否）
pub fn exec_silent(program: &str, args: &[&str]) -> Result<(), String> {
    let status = Command::new(program)
        .args(args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map_err(|e| format!("执行 {} 失败: {}", program, e))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("{} 退出码: {}", program, status))
    }
}

/// 获取命令版本号
pub fn get_version(program: &str, version_flag: &str) -> Option<String> {
    exec_stdout(program, &[version_flag]).ok()
}

/// 检测命令是否存在
pub fn which(program: &str) -> Option<String> {
    if cfg!(target_os = "windows") {
        exec_stdout("where", &[program]).ok()
    } else {
        exec_stdout("which", &[program]).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exec_echo() {
        if cfg!(target_os = "windows") {
            let result = exec_stdout("cmd", &["/c", "echo", "hello"]);
            assert_eq!(result.unwrap(), "hello");
        } else {
            let result = exec_stdout("echo", &["hello"]);
            assert_eq!(result.unwrap(), "hello");
        }
    }

    #[test]
    fn test_which() {
        // node should exist if installed
        let result = which("node");
        // May or may not exist, just testing it doesn't crash
        assert!(result.is_some() || result.is_none());
    }
}
