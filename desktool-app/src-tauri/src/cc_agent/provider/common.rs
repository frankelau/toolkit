// provider/common.rs — Provider 共享逻辑
// Sprint S1: 跨 Provider 共享的工具函数

use crate::cc_agent::types::Engine;

/// 把引擎枚举转成 bridge 使用的字符串
pub fn engine_str(engine: &Engine) -> &'static str {
    match engine {
        Engine::Claude => "claude",
        Engine::Codex => "codex",
    }
}

/// 从字符串解析引擎类型
pub fn parse_engine(s: &str) -> Option<Engine> {
    match s.to_lowercase().as_str() {
        "claude" => Some(Engine::Claude),
        "codex" => Some(Engine::Codex),
        _ => None,
    }
}

/// 生成 JSON-RPC 请求
pub fn build_jsonrpc_request(method: &str, params: serde_json::Value) -> serde_json::Value {
    serde_json::json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "method": method,
        "params": params,
    })
}

/// 安全解析 JSON 字符串
pub fn safe_parse_json(s: &str) -> Option<serde_json::Value> {
    serde_json::from_str(s).ok()
}

/// 提取字符串字段
pub fn get_string(value: &serde_json::Value, key: &str) -> Option<String> {
    value.get(key).and_then(|v| v.as_str()).map(|s| s.to_string())
}

/// 提取布尔字段
pub fn get_bool(value: &serde_json::Value, key: &str) -> Option<bool> {
    value.get(key).and_then(|v| v.as_bool())
}

/// 提取数字字段（兼容字符串数字）
pub fn get_u64(value: &serde_json::Value, key: &str) -> Option<u64> {
    value
        .get(key)
        .and_then(|v| {
            if let Some(n) = v.as_u64() {
                Some(n)
            } else {
                v.as_str().and_then(|s| s.parse::<u64>().ok())
            }
        })
}

/// 格式化 token 数量为人类可读字符串
pub fn format_tokens(tokens: u64) -> String {
    if tokens >= 1_000_000 {
        format!("{:.1}M", tokens as f64 / 1_000_000.0)
    } else if tokens >= 1_000 {
        format!("{:.1}K", tokens as f64 / 1_000.0)
    } else {
        tokens.to_string()
    }
}

/// 格式化成本
pub fn format_cost(cost_usd: f64) -> String {
    if cost_usd < 0.01 {
        format!("${:.4}", cost_usd)
    } else {
        format!("${:.2}", cost_usd)
    }
}
