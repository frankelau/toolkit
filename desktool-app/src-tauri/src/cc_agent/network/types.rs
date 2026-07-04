// network/types.rs — 网络请求日志类型定义

use serde::{Deserialize, Serialize};

/// 网络请求日志条目
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetEntry {
    /// 请求 ID
    pub id: String,

    /// 提供商 (anthropic, openai, custom, etc.)
    pub provider: String,

    /// 请求 URL
    pub url: String,

    /// HTTP 方法 (GET, POST, etc.)
    pub method: String,

    /// HTTP 状态码
    pub status: Option<u16>,

    /// 请求耗时 (毫秒)
    pub duration_ms: Option<u64>,

    /// 错误信息
    pub error: Option<String>,

    /// 时间戳 (Unix 毫秒)
    pub timestamp: u64,

    /// 请求体预览 (截断)
    pub request_preview: Option<String>,

    /// 响应体预览 (截断)
    pub response_preview: Option<String>,
}

/// 网络请求统计
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetStats {
    /// 总请求数
    pub total_requests: usize,

    /// 成功请求数
    pub success_count: usize,

    /// 失败请求数
    pub error_count: usize,

    /// 平均耗时 (毫秒)
    pub avg_duration_ms: f64,

    /// 按提供商分组的统计
    pub by_provider: std::collections::HashMap<String, ProviderStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStats {
    pub total: usize,
    pub success: usize,
    pub error: usize,
    pub avg_duration_ms: f64,
}
