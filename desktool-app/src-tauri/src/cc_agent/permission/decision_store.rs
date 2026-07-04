// permission/decision_store.rs — 权限决策记忆存储
// 对齐 cc-gui PermissionDecisionStore（工具级 + 参数级记忆）

use std::collections::HashMap;
use std::sync::Mutex;
use super::service::PermissionResponse;

/// 权限决策记忆存储（线程安全）
/// - parameter_decision_memory: 工具名+参数哈希 → 决策值
/// - tool_decision_memory: 工具名 → 是否允许
pub struct PermissionDecisionStore {
    parameter_memory: Mutex<HashMap<String, i32>>,
    tool_memory: Mutex<HashMap<String, bool>>,
}

impl PermissionDecisionStore {
    pub fn new() -> Self {
        Self {
            parameter_memory: Mutex::new(HashMap::new()),
            tool_memory: Mutex::new(HashMap::new()),
        }
    }

    /// 获取工具级决策（无参数）
    pub fn get_tool_decision(&self, tool_name: &str) -> Option<PermissionResponse> {
        let memory = self.tool_memory.lock().ok()?;
        memory.get(tool_name).map(|allow| {
            if *allow {
                PermissionResponse::AllowAlways
            } else {
                PermissionResponse::Deny
            }
        })
    }

    /// 获取参数级决策（工具名+参数）
    pub fn get_parameter_decision(
        &self,
        tool_name: &str,
        inputs: &serde_json::Value,
    ) -> Option<PermissionResponse> {
        let memory = self.parameter_memory.lock().ok()?;
        let key = build_memory_key(tool_name, inputs);
        memory.get(&key).and_then(|v| PermissionResponse::from_value(*v))
    }

    /// 记住工具级决策
    pub fn remember_tool_decision(&self, tool_name: &str, decision: PermissionResponse) {
        if let Ok(mut memory) = self.tool_memory.lock() {
            match decision {
                PermissionResponse::AllowAlways => {
                    memory.insert(tool_name.to_string(), true);
                }
                PermissionResponse::Deny => {
                    memory.insert(tool_name.to_string(), false);
                }
                _ => {}
            }
        }
    }

    /// 记住参数级决策
    pub fn remember_parameter_decision(
        &self,
        tool_name: &str,
        inputs: &serde_json::Value,
        decision: PermissionResponse,
    ) {
        if let Ok(mut memory) = self.parameter_memory.lock() {
            let key = build_memory_key(tool_name, inputs);
            memory.insert(key, decision.value());
        }
    }

    /// 清除所有记忆
    pub fn clear(&self) {
        if let Ok(mut m) = self.parameter_memory.lock() {
            m.clear();
        }
        if let Ok(mut m) = self.tool_memory.lock() {
            m.clear();
        }
    }

    pub fn parameter_memory_size(&self) -> usize {
        self.parameter_memory.lock().map(|m| m.len()).unwrap_or(0)
    }

    pub fn tool_memory_size(&self) -> usize {
        self.tool_memory.lock().map(|m| m.len()).unwrap_or(0)
    }
}

impl Default for PermissionDecisionStore {
    fn default() -> Self {
        Self::new()
    }
}

/// 构建参数级记忆 key（工具名 + 参数 JSON 字符串）
fn build_memory_key(tool_name: &str, inputs: &serde_json::Value) -> String {
    format!("{}:{}", tool_name, inputs)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tool_decision_memory() {
        let store = PermissionDecisionStore::new();
        store.remember_tool_decision("Bash", PermissionResponse::AllowAlways);
        assert_eq!(
            store.get_tool_decision("Bash"),
            Some(PermissionResponse::AllowAlways)
        );
        store.remember_tool_decision("Write", PermissionResponse::Deny);
        assert_eq!(
            store.get_tool_decision("Write"),
            Some(PermissionResponse::Deny)
        );
    }

    #[test]
    fn test_parameter_decision_memory() {
        let store = PermissionDecisionStore::new();
        let inputs = serde_json::json!({"command": "ls -la"});
        store.remember_parameter_decision("Bash", &inputs, PermissionResponse::Allow);
        assert_eq!(
            store.get_parameter_decision("Bash", &inputs),
            Some(PermissionResponse::Allow)
        );
    }

    #[test]
    fn test_clear() {
        let store = PermissionDecisionStore::new();
        store.remember_tool_decision("Bash", PermissionResponse::AllowAlways);
        store.clear();
        assert_eq!(store.get_tool_decision("Bash"), None);
    }
}
