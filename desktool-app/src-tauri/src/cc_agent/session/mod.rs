// session/mod.rs — 会话管理模块入口
// Sprint V2: 从 session.rs 416 行拆分为 5 个子模块
// 对齐 cc-gui 的会话生命周期管理结构

pub mod lifecycle;
pub mod streaming;
pub mod permissions;
pub mod context;
// Sprint B7: 重放去重
pub mod dedup;

// 再导出所有 Tauri 命令（保持 cc_agent.rs 的 pub use 不变）
pub use lifecycle::{
    cc_start_session, cc_abort_session, cc_get_session_status, cc_list_tabs, cc_switch_tab,
    cc_session_health,
};
pub use permissions::{cc_permission_response, cc_set_permission_mode};
pub use context::{
    cc_send_message, cc_get_history, cc_get_context_usage, cc_enhance_prompt,
};

// 流式工具函数（内部使用）
pub use streaming::{
    extract_session_id, extract_thread_id, process_stream_line,
    spawn_stderr_reader, spawn_stdout_reader,
};
