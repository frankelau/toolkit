// session/dedup.rs — B7: 会话重放去重
// 对齐 cc-gui ReplayDeduplicator.java
// 基于消息内容 hash 去重，避免会话重放时出现重复消息

use std::collections::HashSet;

/// 消息哈希去重器
#[derive(Default)]
pub struct MessageDeduplicator {
    seen: HashSet<u64>,
    count: usize,
}

impl MessageDeduplicator {
    pub fn new() -> Self {
        Self { seen: HashSet::new(), count: 0 }
    }

    /// 检查并标记消息是否已处理，返回 true 表示首次出现
    pub fn check(&mut self, content: &str) -> bool {
        let hash = seahash(content);
        if self.seen.contains(&hash) {
            return false;
        }
        self.seen.insert(hash);
        self.count += 1;
        true
    }

    /// 去重并过滤消息列表
    pub fn deduplicate<T: AsRef<str>>(&mut self, messages: Vec<T>) -> Vec<T> {
        messages.into_iter().filter(|m| self.check(m.as_ref())).collect()
    }

    /// 清除去重状态
    pub fn clear(&mut self) {
        self.seen.clear();
        self.count = 0;
    }

    /// 已处理的唯一消息数
    pub fn unique_count(&self) -> usize {
        self.count
    }
}

fn seahash(data: &str) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    data.hash(&mut hasher);
    hasher.finish()
}

/// 对会话消息去重
#[tauri::command]
pub async fn cc_deduplicate_messages(
    messages: Vec<String>,
) -> Result<serde_json::Value, String> {
    let original_count = messages.len();
    let mut dedup = MessageDeduplicator::new();
    let unique: Vec<String> = messages.into_iter()
        .filter(|m| dedup.check(m))
        .collect();

    Ok(serde_json::json!({
        "original_count": original_count,
        "unique_count": unique.len(),
        "duplicates_removed": original_count - unique.len(),
        "messages": unique,
    }))
}
