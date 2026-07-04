// bridge/mod.rs — Node.js bridge 模块入口
// Sprint V3: 从 bridge.rs 128 行深化为 6 文件目录
// 对齐 cc-gui bridge 通信与部署架构

pub mod deploy;
pub mod protocol;
pub mod streaming;
pub mod mcp;
pub mod health;

// Sprint B6: Node检测 + 环境配置
pub mod node_detector;
pub mod env_config;

// 再导出核心函数和命令（保持 cc_agent.rs 的 pub use 不变）
pub use deploy::{
    node_bin, bridge_dir, bridge_script_path, ensure_bridge, find_npm,
    copy_dir_recursive, cc_ensure_bridge,
};
pub use protocol::{BridgeRequest, BridgeResponse, BridgeMethod};
pub use streaming::{send_to_bridge, read_bridge_line, build_request};
pub use mcp::{bridge_list_mcp_servers, bridge_add_mcp_server, bridge_remove_mcp_server};
pub use health::{check_bridge_health, wait_for_bridge_ready, BridgeHealth};
