// permission/registry.rs — 权限服务会话注册表
// 对齐 cc-gui PermissionSessionRegistry（会话实例管理 + 过期清理）

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use super::service::PermissionService;

const SESSION_CLEANUP_INTERVAL_SECS: u64 = 3600; // 1 小时
const SESSION_MAX_IDLE_SECS: u64 = 86400; // 24 小时

/// 权限服务会话注册表
/// - 按 session_id 管理PermissionService 实例
/// - 定期清理超过 24h 未活动的实例
pub struct PermissionSessionRegistry {
    instances: HashMap<String, PermissionService>,
    last_cleanup: u64,
}

impl PermissionSessionRegistry {
    pub fn new() -> Self {
        Self {
            instances: HashMap::new(),
            last_cleanup: now_secs(),
        }
    }

    /// 获取或创建会话实例
    pub fn get_or_create(&mut self, session_id: &str) -> &PermissionService {
        self.cleanup_stale_if_needed();
        self.instances
            .entry(session_id.to_string())
            .or_insert_with(|| PermissionService::new(session_id))
    }

    /// 获取实例（不存在返回 None）
    pub fn get(&self, session_id: &str) -> Option<&PermissionService> {
        self.instances.get(session_id)
    }

    /// 获取可变实例
    pub fn get_mut(&mut self, session_id: &str) -> Option<&mut PermissionService> {
        self.instances.get_mut(session_id)
    }

    /// 移除会话实例
    pub fn remove(&mut self, session_id: &str) -> bool {
        if let Some(svc) = self.instances.remove(session_id) {
            svc.stop();
            eprintln!(
                "PermissionService removed for session={}, remaining={}",
                session_id,
                self.instances.len()
            );
            true
        } else {
            false
        }
    }

    /// 当前实例数
    pub fn len(&self) -> usize {
        self.instances.len()
    }

    pub fn is_empty(&self) -> bool {
        self.instances.is_empty()
    }

    /// 清理过期会话（超过 24h 未活动）
    fn cleanup_stale_if_needed(&mut self) {
        let now = now_secs();
        if now.saturating_sub(self.last_cleanup) < SESSION_CLEANUP_INTERVAL_SECS {
            return;
        }
        self.last_cleanup = now;

        let stale_ids: Vec<String> = self
            .instances
            .iter()
            .filter(|(_, svc)| {
                now.saturating_sub(svc.get_last_activity_time()) > SESSION_MAX_IDLE_SECS
            })
            .map(|(id, _)| id.clone())
            .collect();

        for id in &stale_ids {
            if let Some(svc) = self.instances.remove(id) {
                svc.stop();
                eprintln!("Cleaned up stale permission session: {}", id);
            }
        }

        if !stale_ids.is_empty() {
            eprintln!(
                "Cleaned up {} stale session(s), remaining={}",
                stale_ids.len(),
                self.instances.len()
            );
        }
    }

    /// 生成新的 legacy session id
    pub fn new_legacy_session_id() -> String {
        format!(
            "legacy-{}",
            now_millis()
        )
    }
}

impl Default for PermissionSessionRegistry {
    fn default() -> Self {
        Self::new()
    }
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_get_or_create() {
        let mut reg = PermissionSessionRegistry::new();
        assert!(reg.is_empty());
        let _ = reg.get_or_create("session-1");
        assert_eq!(reg.len(), 1);
        let _ = reg.get_or_create("session-1"); // 重复不创建
        assert_eq!(reg.len(), 1);
        let _ = reg.get_or_create("session-2");
        assert_eq!(reg.len(), 2);
    }

    #[test]
    fn test_registry_remove() {
        let mut reg = PermissionSessionRegistry::new();
        let _ = reg.get_or_create("session-1");
        assert!(reg.remove("session-1"));
        assert!(reg.is_empty());
        assert!(!reg.remove("session-1")); // 已移除
    }
}
