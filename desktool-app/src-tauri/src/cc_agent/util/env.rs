// util/env.rs — 环境变量工具

/// 获取环境变量（可选默认值）
pub fn get(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

/// 获取环境变量（返回 Option）
pub fn get_optional(key: &str) -> Option<String> {
    std::env::var(key).ok()
}

/// 检查环境变量是否存在且非空
pub fn has(key: &str) -> bool {
    std::env::var(key).map(|v| !v.is_empty()).unwrap_or(false)
}

/// 获取布尔型环境变量（true/1/yes 视为 true）
pub fn get_bool(key: &str, default: bool) -> bool {
    std::env::var(key)
        .ok()
        .map(|v| {
            let lower = v.to_lowercase();
            matches!(lower.as_str(), "1" | "true" | "yes" | "on")
        })
        .unwrap_or(default)
}

/// 获取整数型环境变量
pub fn get_int(key: &str, default: i64) -> i64 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

/// 展开环境变量引用（${VAR} 或 $VAR）
pub fn expand_env(text: &str) -> String {
    let re = regex::Regex::new(r"\$\{?(\w+)\}?").unwrap();
    re.replace_all(text, |caps: &regex::Captures| {
        let var_name = caps.get(1).unwrap().as_str();
        std::env::var(var_name).unwrap_or_else(|_| caps.get(0).unwrap().as_str().to_string())
    })
    .to_string()
}

/// 列出所有环境变量（以 KEY=VALUE 格式）
pub fn list_all() -> Vec<String> {
    let mut vars: Vec<String> = std::env::vars()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect();
    vars.sort();
    vars
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_with_default() {
        assert_eq!(get("THIS_VAR_SHOULD_NOT_EXIST_XYZ", "default"), "default");
    }

    #[test]
    fn test_has() {
        assert!(has("PATH") || has("HOME"));
        assert!(!has("THIS_VAR_SHOULD_NOT_EXIST_XYZ"));
    }

    #[test]
    fn test_get_bool() {
        std::env::set_var("TEST_BOOL_TRUE", "1");
        assert!(get_bool("TEST_BOOL_TRUE", false));
        assert!(!get_bool("TEST_BOOL_FALSE_MISSING", false));
    }

    #[test]
    fn test_expand_env() {
        std::env::set_var("TEST_EXPAND", "hello");
        assert_eq!(expand_env("${TEST_EXPAND} world"), "hello world");
    }
}
