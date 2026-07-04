// cache.rs — 缓存层
// Sprint S3: 会话/文件/Provider 能力缓存
//
// 对齐 cc-gui 的 CacheService：
// - 会话列表缓存（带 TTL）
// - 文件内容缓存（LRU）
// - Provider 能力缓存
// - MCP 工具列表缓存

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// 缓存条目
struct CacheEntry<T> {
    value: T,
    inserted_at: Instant,
    ttl: Duration,
}

impl<T> CacheEntry<T> {
    fn new(value: T, ttl: Duration) -> Self {
        Self {
            value,
            inserted_at: Instant::now(),
            ttl,
        }
    }

    fn is_expired(&self) -> bool {
        self.inserted_at.elapsed() > self.ttl
    }
}

/// 通用 TTL 缓存
pub struct TTLCache<T: Clone + Send + Sync + 'static> {
    entries: Arc<RwLock<HashMap<String, CacheEntry<T>>>>,
    default_ttl: Duration,
}

impl<T: Clone + Send + Sync + 'static> TTLCache<T> {
    pub fn new(default_ttl: Duration) -> Self {
        Self {
            entries: Arc::new(RwLock::new(HashMap::new())),
            default_ttl,
        }
    }

    /// 获取缓存值（如果未过期）
    pub async fn get(&self, key: &str) -> Option<T> {
        let entries = self.entries.read().await;
        let entry = entries.get(key)?;
        if entry.is_expired() {
            return None;
        }
        Some(entry.value.clone())
    }

    /// 设置缓存值
    pub async fn set(&self, key: String, value: T) {
        self.set_with_ttl(key, value, self.default_ttl).await;
    }

    /// 设置缓存值（自定义 TTL）
    pub async fn set_with_ttl(&self, key: String, value: T, ttl: Duration) {
        let mut entries = self.entries.write().await;
        entries.insert(key, CacheEntry::new(value, ttl));
    }

    /// 移除缓存条目
    pub async fn remove(&self, key: &str) {
        let mut entries = self.entries.write().await;
        entries.remove(key);
    }

    /// 清空所有缓存
    pub async fn clear(&self) {
        let mut entries = self.entries.write().await;
        entries.clear();
    }

    /// 清理过期条目
    pub async fn evict_expired(&self) {
        let mut entries = self.entries.write().await;
        entries.retain(|_, entry| !entry.is_expired());
    }

    /// 当前缓存条目数
    pub async fn len(&self) -> usize {
        self.entries.read().await.len()
    }
}

// ─── 全局缓存实例 ───────────────────────────────────────────────────────────

/// 会话列表缓存（TTL: 30 秒）
pub fn session_list_cache() -> &'static TTLCache<Vec<serde_json::Value>> {
    use std::sync::OnceLock;
    static CACHE: OnceLock<TTLCache<Vec<serde_json::Value>>> = OnceLock::new();
    CACHE.get_or_init(|| TTLCache::new(Duration::from_secs(30)))
}

/// 文件内容缓存（TTL: 5 分钟）
pub fn file_content_cache() -> &'static TTLCache<String> {
    use std::sync::OnceLock;
    static CACHE: OnceLock<TTLCache<String>> = OnceLock::new();
    CACHE.get_or_init(|| TTLCache::new(Duration::from_secs(300)))
}

/// Provider 能力缓存（TTL: 1 小时，能力很少变化）
pub fn provider_capabilities_cache() -> &'static TTLCache<serde_json::Value> {
    use std::sync::OnceLock;
    static CACHE: OnceLock<TTLCache<serde_json::Value>> = OnceLock::new();
    CACHE.get_or_init(|| TTLCache::new(Duration::from_secs(3600)))
}

/// MCP 工具列表缓存（TTL: 10 分钟）
pub fn mcp_tools_cache() -> &'static TTLCache<Vec<serde_json::Value>> {
    use std::sync::OnceLock;
    static CACHE: OnceLock<TTLCache<Vec<serde_json::Value>>> = OnceLock::new();
    CACHE.get_or_init(|| TTLCache::new(Duration::from_secs(600)))
}

// ─── 缓存清理命令 ───────────────────────────────────────────────────────────

/// 清理所有缓存
pub async fn clear_all_caches() {
    session_list_cache().clear().await;
    file_content_cache().clear().await;
    provider_capabilities_cache().clear().await;
    mcp_tools_cache().clear().await;
}

/// 清理所有过期条目
pub async fn evict_all_expired() {
    session_list_cache().evict_expired().await;
    file_content_cache().evict_expired().await;
    provider_capabilities_cache().evict_expired().await;
    mcp_tools_cache().evict_expired().await;
}

/// 获取所有缓存的统计信息
pub async fn cache_stats() -> serde_json::Value {
    serde_json::json!({
        "sessionList": session_list_cache().len().await,
        "fileContent": file_content_cache().len().await,
        "providerCapabilities": provider_capabilities_cache().len().await,
        "mcpTools": mcp_tools_cache().len().await,
    })
}

/// Tauri 命令：清理所有缓存
#[tauri::command]
pub async fn cc_clear_caches() -> Result<(), String> {
    clear_all_caches().await;
    Ok(())
}

/// Tauri 命令：获取缓存统计
#[tauri::command]
pub async fn cc_cache_stats() -> Result<serde_json::Value, String> {
    Ok(cache_stats().await)
}
