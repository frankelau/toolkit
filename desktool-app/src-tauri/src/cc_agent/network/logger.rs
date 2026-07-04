// network/logger.rs — 内存网络日志存储 + Tauri 命令

use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use std::collections::HashMap;
use tauri::State;

use crate::cc_agent::network::types::{NetEntry, NetStats, ProviderStats};

const MAX_ENTRIES: usize = 500;
const PREVIEW_LIMIT: usize = 512;

/// Tauri managed state
#[derive(Default)]
pub struct NetworkLogState {
    entries: Arc<Mutex<Vec<NetEntry>>>,
}

impl NetworkLogState {
    /// 记录一条网络请求日志
    pub fn record(
        &self,
        provider: impl Into<String>,
        url: impl Into<String>,
        method: impl Into<String>,
        status: Option<u16>,
        duration_ms: u64,
        error: Option<String>,
        request_preview: Option<String>,
        response_preview: Option<String>,
    ) {
        let entry = NetEntry {
            id: next_id(),
            provider: provider.into(),
            url: url.into(),
            method: method.into(),
            status,
            duration_ms: Some(duration_ms),
            error,
            timestamp: now_ms(),
            request_preview: request_preview.map(|s| truncate(s, PREVIEW_LIMIT)),
            response_preview: response_preview.map(|s| truncate(s, PREVIEW_LIMIT)),
        };

        let mut entries = self.entries.lock().unwrap();
        entries.insert(0, entry);
        if entries.len() > MAX_ENTRIES {
            entries.truncate(MAX_ENTRIES);
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn next_id() -> String {
    format!("{:x}", now_ms() ^ (std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos() as u64))
}

fn truncate(s: String, max: usize) -> String {
    if s.len() <= max {
        s
    } else {
        format!("{}…", &s[..max])
    }
}

// ─── Tauri 命令 ───────────────────────────────────────────────────────────────

/// 获取网络请求日志 (最新在前, 最多 500 条)
#[tauri::command]
pub async fn cc_get_network_log(
    state: State<'_, NetworkLogState>,
) -> Result<Vec<NetEntry>, String> {
    let entries = state.entries.lock().map_err(|e| e.to_string())?;
    Ok(entries.clone())
}

/// 清空网络请求日志
#[tauri::command]
pub async fn cc_clear_network_log(
    state: State<'_, NetworkLogState>,
) -> Result<(), String> {
    let mut entries = state.entries.lock().map_err(|e| e.to_string())?;
    entries.clear();
    Ok(())
}

/// 获取网络请求统计信息
#[tauri::command]
pub async fn cc_get_network_stats(
    state: State<'_, NetworkLogState>,
) -> Result<NetStats, String> {
    let entries = state.entries.lock().map_err(|e| e.to_string())?;

    let total = entries.len();
    let success = entries.iter().filter(|e| e.error.is_none() && e.status.map_or(true, |s| s < 400)).count();
    let error = total - success;
    let avg_duration = if total == 0 {
        0.0
    } else {
        entries.iter().filter_map(|e| e.duration_ms).sum::<u64>() as f64 / total as f64
    };

    let mut by_provider: HashMap<String, (usize, usize, usize, u64)> = HashMap::new();
    for e in entries.iter() {
        let entry = by_provider.entry(e.provider.clone()).or_default();
        entry.0 += 1;
        let ok = e.error.is_none() && e.status.map_or(true, |s| s < 400);
        if ok { entry.1 += 1; } else { entry.2 += 1; }
        entry.3 += e.duration_ms.unwrap_or(0);
    }

    let by_provider = by_provider
        .into_iter()
        .map(|(provider, (total, success, error, dur))| {
            let avg = if total == 0 { 0.0 } else { dur as f64 / total as f64 };
            (provider, ProviderStats { total, success, error, avg_duration_ms: avg })
        })
        .collect();

    Ok(NetStats {
        total_requests: total,
        success_count: success,
        error_count: error,
        avg_duration_ms: avg_duration,
        by_provider,
    })
}
