// permission/mod.rs — 权限审批系统入口
// Sprint V1: 从 cc-gui permission 包（12 文件 2490 行）适配为 Rust 模块
// 对齐 cc-gui PermissionManager + PermissionService + PermissionDecisionStore + PermissionSessionRegistry

pub mod manager;
pub mod request;
pub mod decision_store;
pub mod service;
pub mod registry;

// 再导出核心类型
pub use manager::{PermissionManager, PermissionMode};
pub use request::{PermissionRequest, PermissionResult, PermissionBehavior};
pub use decision_store::PermissionDecisionStore;
pub use service::{PermissionService, PermissionResponse, PermissionDecision};
pub use registry::PermissionSessionRegistry;

use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;
use super::types::SessionManager;

/// 全局权限管理器状态（通过 Tauri State 注入）
pub struct PermissionState {
    pub manager: Arc<Mutex<PermissionManager>>,
    pub registry: Arc<Mutex<PermissionSessionRegistry>>,
}

impl PermissionState {
    pub fn new() -> Self {
        Self {
            manager: Arc::new(Mutex::new(PermissionManager::new())),
            registry: Arc::new(Mutex::new(PermissionSessionRegistry::new())),
        }
    }
}

impl Default for PermissionState {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Tauri 命令 ─────────────────────────────────────────────────────────────

/// 设置权限模式（DEFAULT / ACCEPT_EDITS / ALLOW_ALL / DENY_ALL）
#[tauri::command]
pub async fn cc_set_permission_mode_v2(
    mode: String,
    state: State<'_, PermissionState>,
) -> Result<String, String> {
    let mut manager = state.manager.lock().await;
    manager.set_mode(&mode);
    Ok(format!("Permission mode set to: {}", mode))
}

/// 获取当前权限模式
#[tauri::command]
pub async fn cc_get_permission_mode(
    state: State<'_, PermissionState>,
) -> Result<String, String> {
    let manager = state.manager.lock().await;
    Ok(format!("{:?}", manager.mode))
}

/// 清除权限决策记忆
#[tauri::command]
pub async fn cc_clear_permission_memory(
    state: State<'_, PermissionState>,
) -> Result<String, String> {
    let mut manager = state.manager.lock().await;
    let (param_size, tool_size) = manager.clear_memory();
    Ok(format!(
        "Cleared permission memory: param={}, tool={}",
        param_size, tool_size
    ))
}

/// 响应权限请求（前端 Dialog 用户点击后调用）
#[tauri::command]
pub async fn cc_respond_permission(
    request_id: String,
    response: String,
    updated_input: Option<serde_json::Value>,
    state: State<'_, PermissionState>,
) -> Result<bool, String> {
    let manager = state.manager.lock().await;
    manager
        .respond(&request_id, &response, updated_input)
        .await
        .map_err(|e| e.to_string())
}

/// 列出待处理的权限请求（供前端轮询或调试用）
#[tauri::command]
pub async fn cc_list_pending_permissions(
    state: State<'_, PermissionState>,
) -> Result<Vec<serde_json::Value>, String> {
    let manager = state.manager.lock().await;
    Ok(manager.list_pending())
}

/// 移除会话的 PermissionService 实例（会话结束时调用）
#[tauri::command]
pub async fn cc_remove_permission_session(
    session_id: String,
    state: State<'_, PermissionState>,
) -> Result<bool, String> {
    let mut registry = state.registry.lock().await;
    registry.remove(&session_id);
    Ok(true)
}
