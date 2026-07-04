// bridge/health.rs — bridge 健康检查
// Sprint V3: 检查 bridge 状态 + 等待就绪

use std::path::Path;
use std::time::{Duration, Instant};

/// bridge 健康状态
#[derive(Debug, Clone)]
pub struct BridgeHealth {
    pub script_exists: bool,
    pub node_modules_exists: bool,
    pub package_json_exists: bool,
    pub bridge_dir: String,
}

impl BridgeHealth {
    pub fn is_healthy(&self) -> bool {
        self.script_exists && self.node_modules_exists && self.package_json_exists
    }

    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "healthy": self.is_healthy(),
            "scriptExists": self.script_exists,
            "nodeModulesExists": self.node_modules_exists,
            "packageJsonExists": self.package_json_exists,
            "bridgeDir": self.bridge_dir,
        })
    }
}

/// 检查 bridge 健康状态
pub fn check_bridge_health() -> BridgeHealth {
    let bridge_dir = super::deploy::bridge_dir();
    let script_path = super::deploy::bridge_script_path();
    let node_modules = format!("{}/node_modules", bridge_dir);
    let package_json = format!("{}/package.json", bridge_dir);

    BridgeHealth {
        script_exists: Path::new(&script_path).exists(),
        node_modules_exists: Path::new(&node_modules).exists(),
        package_json_exists: Path::new(&package_json).exists(),
        bridge_dir,
    }
}

/// 等待 bridge 就绪（轮询 daemon ready 事件）
/// 注：实际 ready 信号通过 stdout 事件传递，这里只检查文件就绪
pub async fn wait_for_bridge_ready(timeout_secs: u64) -> Result<BridgeHealth, String> {
    let deadline = Instant::now() + Duration::from_secs(timeout_secs);

    loop {
        let health = check_bridge_health();
        if health.is_healthy() {
            return Ok(health);
        }

        if Instant::now() >= deadline {
            return Err(format!(
                "Bridge not ready after {}s. Health: {}",
                timeout_secs,
                health.to_json()
            ));
        }

        tokio::time::sleep(Duration::from_millis(500)).await;
    }
}

/// 检查 node 二进制是否可用
pub fn check_node_available() -> Option<String> {
    let node = super::deploy::node_bin();
    if Path::new(&node).exists() {
        Some(node)
    } else {
        None
    }
}

/// 获取 bridge 版本（从 package.json 读取）
pub fn get_bridge_version() -> Option<String> {
    let package_json = format!("{}/package.json", super::deploy::bridge_dir());
    let content = std::fs::read_to_string(&package_json).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    json.get("version")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_is_healthy() {
        let healthy = BridgeHealth {
            script_exists: true,
            node_modules_exists: true,
            package_json_exists: true,
            bridge_dir: "/tmp/test".to_string(),
        };
        assert!(healthy.is_healthy());

        let unhealthy = BridgeHealth {
            script_exists: true,
            node_modules_exists: false,
            package_json_exists: true,
            bridge_dir: "/tmp/test".to_string(),
        };
        assert!(!unhealthy.is_healthy());
    }

    #[test]
    fn test_check_bridge_health() {
        let health = check_bridge_health();
        // 只验证不 panic
        let _ = health.to_json();
    }
}
