// util/crypto.rs — 密码学工具（哈希/ID 生成）

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

/// 生成 UUID v4
pub fn uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// 简单字符串哈希（非加密用途）
pub fn simple_hash(s: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    s.hash(&mut hasher);
    hasher.finish()
}

/// 字符串哈希（十六进制输出）
pub fn hash_hex(s: &str) -> String {
    format!("{:016x}", simple_hash(s))
}

/// 生成短 ID（8 字符十六进制）
pub fn short_id() -> String {
    let u = uuid::Uuid::new_v4();
    format!("{:08x}", u.as_u128() as u32)
}

/// 生成会话 ID 格式 (legacy: "session_xxxx")
pub fn legacy_session_id() -> String {
    format!("session_{}", short_id())
}

/// 生成随机字符串（字母数字，基于 UUID）
pub fn random_alphanumeric(len: usize) -> String {
    // 用 UUID 作为随机源
    let base = uuid::Uuid::new_v4().to_string().replace('-', "");
    let mut result = String::new();
    for ch in base.chars().cycle().take(len) {
        // 将 hex 字符映射到字母数字混合
        match ch {
            '0'..='9' => result.push(ch),
            'a'..='f' => result.push((b'a' + (ch as u8 - b'a') % 26) as char),
            _ => result.push(ch),
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uuid_unique() {
        let a = uuid();
        let b = uuid();
        assert_ne!(a, b);
        assert_eq!(a.len(), 36);
    }

    #[test]
    fn test_hash_deterministic() {
        assert_eq!(hash_hex("hello"), hash_hex("hello"));
        assert_ne!(hash_hex("hello"), hash_hex("world"));
    }

    #[test]
    fn test_short_id_length() {
        assert_eq!(short_id().len(), 8);
    }
}
