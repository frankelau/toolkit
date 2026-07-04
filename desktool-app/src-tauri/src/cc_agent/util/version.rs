// util/version.rs — 版本号比较工具
// 对齐 cc-gui dependency 模块中的版本比较逻辑

/// 语义化版本
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SemVer {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
    pub pre_release: Option<String>,
}

impl SemVer {
    /// 解析 "1.2.3-beta.1" 格式
    pub fn parse(version: &str) -> Option<Self> {
        let version = version.trim().trim_start_matches('v').trim_start_matches('V');
        let (version_part, pre) = if let Some(idx) = version.find('-') {
            (&version[..idx], Some(version[idx + 1..].to_string()))
        } else {
            (version, None)
        };

        let parts: Vec<&str> = version_part.split('.').collect();
        if parts.is_empty() || parts.len() > 3 {
            return None;
        }

        let major = parts[0].parse().ok()?;
        let minor = if parts.len() > 1 { parts[1].parse().ok()? } else { 0 };
        let patch = if parts.len() > 2 { parts[2].parse().ok()? } else { 0 };

        Some(Self { major, minor, patch, pre_release: pre })
    }

    /// 尝试从任意文本中提取版本号
    pub fn extract(text: &str) -> Option<Self> {
        // 匹配类似 "1.2.3" 或 "v1.2.3" 的模式
        let re = regex::Regex::new(r"(\d+\.\d+(?:\.\d+)?)").ok()?;
        let caps = re.captures(text)?;
        let version_str = caps.get(1)?.as_str();
        Self::parse(version_str)
    }
}

impl std::fmt::Display for SemVer {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.patch)?;
        if let Some(ref pre) = self.pre_release {
            write!(f, "-{}", pre)?;
        }
        Ok(())
    }
}

impl PartialOrd for SemVer {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for SemVer {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.major.cmp(&other.major)
            .then(self.minor.cmp(&other.minor))
            .then(self.patch.cmp(&other.patch))
            .then_with(|| {
                match (&self.pre_release, &other.pre_release) {
                    (None, None) => std::cmp::Ordering::Equal,
                    (None, Some(_)) => std::cmp::Ordering::Greater,
                    (Some(_), None) => std::cmp::Ordering::Less,
                    (Some(a), Some(b)) => a.cmp(b),
                }
            })
    }
}

/// 比较两个版本字符串
pub fn compare_versions(a: &str, b: &str) -> Option<std::cmp::Ordering> {
    let sa = SemVer::parse(a)?;
    let sb = SemVer::parse(b)?;
    Some(sa.cmp(&sb))
}

/// 判断版本是否满足最低要求
pub fn meets_minimum(version: &str, minimum: &str) -> bool {
    match compare_versions(version, minimum) {
        Some(ord) => ord != std::cmp::Ordering::Less,
        None => false,
    }
}

/// 规范化版本号（去掉 v 前缀和多余部分）
pub fn normalize_version(raw: &str) -> String {
    // 取第一行、去掉 v 前缀
    let first_line = raw.lines().next().unwrap_or(raw);
    let trimmed = first_line.trim().trim_start_matches('v').trim_start_matches('V');
    // 尝试匹配 X.Y.Z 格式
    if let Some(ver) = SemVer::parse(trimmed) {
        ver.to_string()
    } else {
        // 回退：取第一个看起来像版本号的部分
        let re = regex::Regex::new(r"(\d+\.\d+(?:\.\d+)?)").unwrap();
        if let Some(caps) = re.captures(trimmed) {
            caps.get(1).unwrap().as_str().to_string()
        } else {
            trimmed.to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse() {
        let v = SemVer::parse("1.2.3").unwrap();
        assert_eq!((v.major, v.minor, v.patch), (1, 2, 3));

        let v = SemVer::parse("v2.0.0-beta.1").unwrap();
        assert_eq!(v.major, 2);
        assert_eq!(v.pre_release, Some("beta.1".into()));
    }

    #[test]
    fn test_compare() {
        assert!(compare_versions("1.2.3", "1.2.4") == Some(std::cmp::Ordering::Less));
        assert!(compare_versions("2.0.0", "1.9.9") == Some(std::cmp::Ordering::Greater));
        assert!(compare_versions("1.0.0", "1.0.0") == Some(std::cmp::Ordering::Equal));
        assert!(compare_versions("1.0.0-alpha", "1.0.0") == Some(std::cmp::Ordering::Less));
    }

    #[test]
    fn test_meets_minimum() {
        assert!(meets_minimum("1.5.0", "1.0.0"));
        assert!(!meets_minimum("0.9.0", "1.0.0"));
    }

    #[test]
    fn test_normalize() {
        assert_eq!(normalize_version("v1.2.3"), "1.2.3");
        assert_eq!(normalize_version("node v20.11.0\n(more text)"), "20.11.0");
    }

    #[test]
    fn test_extract() {
        let v = SemVer::extract("Node.js v20.11.0 (LTS)");
        assert_eq!(v.unwrap().major, 20);
    }
}
