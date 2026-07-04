// network/mod.rs — cc_agent 网络请求日志模块

mod logger;
mod types;

pub use logger::{NetworkLogState, cc_get_network_log, cc_clear_network_log, cc_get_network_stats};
pub use types::{NetEntry, NetStats};

/// 便捷宏：从任意拿到 NetworkLogState 的地方记录一次请求
///
/// 用法：record_net!(state, "anthropic", "https://...", "GET", Some(200), elapsed_ms, None, None, None);
#[macro_export]
macro_rules! record_net {
    (
        $state:expr,
        $provider:expr,
        $url:expr,
        $method:expr,
        $status:expr,
        $duration_ms:expr,
        $error:expr,
        $req_preview:expr,
        $res_preview:expr
    ) => {
        $state.record($provider, $url, $method, $status, $duration_ms, $error, $req_preview, $res_preview)
    };
}
