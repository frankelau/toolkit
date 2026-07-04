// handler/core.rs — Handler 核心框架
// Sprint Final F1: 对齐 cc-gui 的 core 包（HandlerRegistry + HandlerFactory + 命令注册）
//
// cc-gui (Java): core 包提供 MessageDispatcher 注册中心、Handler 工厂、事件路由
// ccagent (Rust): 本文件提供 HandlerRegistry（动态注册中心）+ HandlerFactory
//                 + 7 个 #[tauri::command] 包装，让前端可直接调用 handler 逻辑
//
// 设计要点：
// 1. HandlerRegistry 是 mod.rs MessageDispatcher 的动态版，支持按名称查询/列举
// 2. HandlerFactory 按 name 创建 handler 实例（对应 cc-gui HandlerFactory）
// 3. 命令包装统一放本文件，避免分散在各子模块，便于 lib.rs 集中注册
// 4. 所有命令返回 Result<T, String>，与现有 cc_* 命令风格一致

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use super::file::{self, FileTreeNode, FileStats};
use super::diff;
use super::context::{self, WorkspaceContext};
use super::history::{self, SessionStats};

// ─── HandlerRegistry ───────────────────────────────────────────────────────

/// Handler 注册表（动态版）
///
/// 对应 cc-gui 的 DispatcherRegistry。与 mod.rs 的 MessageDispatcher 不同：
/// - MessageDispatcher 持有 Vec<Box<dyn MessageHandler>>，顺序分发
/// - HandlerRegistry 持有 HashMap<String, HandlerMeta>，按名称查询/列举/统计
///
/// 适用于需要"列出所有 handler"、"按名称查找"、"统计调用次数"的场景。
pub struct HandlerRegistry {
    handlers: HashMap<String, HandlerMeta>,
}

/// Handler 元信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct HandlerMeta {
    /// Handler 名称
    pub name: String,
    /// 描述
    pub description: String,
    /// 处理的事件类型列表
    pub handled_events: Vec<String>,
    /// 是否启用
    pub enabled: bool,
    /// 累计调用次数
    pub call_count: u64,
}

impl HandlerRegistry {
    pub fn new() -> Self {
        Self { handlers: HashMap::new() }
    }

    /// 注册 handler 元信息
    pub fn register(&mut self, meta: HandlerMeta) {
        self.handlers.insert(meta.name.clone(), meta);
    }

    /// 按名称查找
    pub fn get(&self, name: &str) -> Option<&HandlerMeta> {
        self.handlers.get(name)
    }

    /// 列出所有 handler 元信息
    pub fn list(&self) -> Vec<HandlerMeta> {
        self.handlers.values().cloned().collect()
    }

    /// 启用/禁用 handler
    pub fn set_enabled(&mut self, name: &str, enabled: bool) -> bool {
        if let Some(meta) = self.handlers.get_mut(name) {
            meta.enabled = enabled;
            true
        } else {
            false
        }
    }

    /// 递增调用计数
    pub fn increment_call(&mut self, name: &str) {
        if let Some(meta) = self.handlers.get_mut(name) {
            meta.call_count += 1;
        }
    }

    /// 创建默认注册表（注册 4 个内置 handler）
    pub fn with_defaults() -> Self {
        let mut reg = Self::new();
        reg.register(HandlerMeta {
            name: "file".into(),
            description: "文件操作 handler — 文件树/读取/统计".into(),
            handled_events: vec!["tool_use".into(), "tool_result".into()],
            enabled: true,
            call_count: 0,
        });
        reg.register(HandlerMeta {
            name: "history".into(),
            description: "历史会话 handler — 搜索/删除/统计".into(),
            handled_events: vec!["session_end".into()],
            enabled: true,
            call_count: 0,
        });
        reg.register(HandlerMeta {
            name: "diff".into(),
            description: "Diff 计算 handler — 行级/文件级 diff".into(),
            handled_events: vec!["tool_result".into()],
            enabled: true,
            call_count: 0,
        });
        reg.register(HandlerMeta {
            name: "context".into(),
            description: "上下文用量 handler — 工作区上下文收集".into(),
            handled_events: vec!["usage".into()],
            enabled: true,
            call_count: 0,
        });
        reg
    }
}

impl Default for HandlerRegistry {
    fn default() -> Self {
        Self::with_defaults()
    }
}

// ─── HandlerFactory ────────────────────────────────────────────────────────

/// Handler 工厂
///
/// 对应 cc-gui 的 HandlerFactory。按名称创建对应的 MessageHandler 实例。
/// 注意：返回的是 super::MessageHandler trait 对象，需配合 MessageDispatcher 使用。
pub struct HandlerFactory;

impl HandlerFactory {
    /// 按名称创建 handler（返回是否支持该名称）
    pub fn supports(name: &str) -> bool {
        matches!(name, "file" | "history" | "diff" | "context")
    }

    /// 列出所有支持的 handler 名称
    pub fn supported_names() -> Vec<&'static str> {
        vec!["file", "history", "diff", "context"]
    }

    /// 创建默认的 Arc<MessageDispatcher>（4 个内置 handler）
    pub fn create_default_dispatcher() -> Arc<super::MessageDispatcher> {
        super::create_default_dispatcher()
    }
}

// ─── DispatchResult ────────────────────────────────────────────────────────

/// 分发结果
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DispatchResult {
    /// 已处理
    Handled { handler: String },
    /// 未处理（无 handler 匹配）
    Unhandled,
    /// 错误
    Error { message: String },
}

// ─── 命令包装：file ────────────────────────────────────────────────────────

/// 构建文件树
#[tauri::command]
pub async fn cc_build_file_tree(
    root: String,
    max_depth: Option<usize>,
    ignore_patterns: Option<Vec<String>>,
) -> Result<FileTreeNode, String> {
    let path = PathBuf::from(&root);
    if !path.exists() {
        return Err(format!("路径不存在: {}", root));
    }
    let patterns = ignore_patterns.unwrap_or_default();
    Ok(file::build_file_tree(&path, max_depth, &patterns))
}

/// 获取目录统计
#[tauri::command]
pub async fn cc_get_directory_stats(
    dir: String,
    ignore_patterns: Option<Vec<String>>,
) -> Result<FileStats, String> {
    let path = PathBuf::from(&dir);
    if !path.is_dir() {
        return Err(format!("不是有效目录: {}", dir));
    }
    let patterns = ignore_patterns.unwrap_or_default();
    Ok(file::get_directory_stats(&path, &patterns))
}

// ─── 命令包装：diff ────────────────────────────────────────────────────────

/// 比较两段文本的差异
#[tauri::command]
pub async fn cc_diff_texts(
    old_text: String,
    new_text: String,
) -> Result<DiffTextsResult, String> {
    let (adds, dels, patch) = diff::diff_texts(&old_text, &new_text);
    Ok(DiffTextsResult { adds, dels, patch })
}

/// Diff 文本结果
#[derive(Debug, Clone, serde::Serialize)]
pub struct DiffTextsResult {
    pub adds: usize,
    pub dels: usize,
    pub patch: String,
}

/// 计算行级 diff 的增删行数
#[tauri::command]
pub async fn cc_compute_line_diff(
    old_text: String,
    new_text: String,
) -> Result<LineDiffResult, String> {
    let (adds, dels) = diff::compute_line_diff(&old_text, &new_text);
    Ok(LineDiffResult { adds, dels })
}

/// 行 diff 结果
#[derive(Debug, Clone, serde::Serialize)]
pub struct LineDiffResult {
    pub adds: usize,
    pub dels: usize,
}

// ─── 命令包装：context ─────────────────────────────────────────────────────

/// 收集工作区上下文
#[tauri::command]
pub async fn cc_collect_workspace_context(cwd: String) -> Result<WorkspaceContext, String> {
    let path = PathBuf::from(&cwd);
    if !path.is_dir() {
        return Err(format!("不是有效目录: {}", cwd));
    }
    Ok(context::collect_workspace_context(&path))
}

// ─── 命令包装：history ─────────────────────────────────────────────────────

/// 获取会话统计
#[tauri::command]
pub async fn cc_get_session_stats(
    project_name: String,
) -> Result<SessionStats, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "无法获取 HOME 目录".to_string())?;
    Ok(history::get_session_stats(&home, &project_name))
}

/// 按 ID 删除会话
#[tauri::command]
pub async fn cc_delete_session_by_id(
    project_name: String,
    session_id: String,
) -> Result<(), String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "无法获取 HOME 目录".to_string())?;
    history::delete_session(&home, &project_name, &session_id)
}

// ─── 命令包装：registry ────────────────────────────────────────────────────

/// 列出所有已注册的 handler 元信息
#[tauri::command]
pub fn cc_list_handlers() -> Result<Vec<HandlerMeta>, String> {
    Ok(HandlerRegistry::with_defaults().list())
}

// ─── 单元测试 ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_default_has_four_handlers() {
        let reg = HandlerRegistry::with_defaults();
        assert_eq!(reg.list().len(), 4);
        assert!(reg.get("file").is_some());
        assert!(reg.get("history").is_some());
        assert!(reg.get("diff").is_some());
        assert!(reg.get("context").is_some());
    }

    #[test]
    fn test_registry_set_enabled() {
        let mut reg = HandlerRegistry::with_defaults();
        assert!(reg.set_enabled("file", false));
        assert_eq!(reg.get("file").unwrap().enabled, false);
        assert!(!reg.set_enabled("nonexistent", true));
    }

    #[test]
    fn test_registry_increment_call() {
        let mut reg = HandlerRegistry::with_defaults();
        reg.increment_call("diff");
        reg.increment_call("diff");
        assert_eq!(reg.get("diff").unwrap().call_count, 2);
    }

    #[test]
    fn test_factory_supports() {
        assert!(HandlerFactory::supports("file"));
        assert!(HandlerFactory::supports("context"));
        assert!(!HandlerFactory::supports("unknown"));
        assert_eq!(HandlerFactory::supported_names().len(), 4);
    }

    #[test]
    fn test_factory_create_default_dispatcher() {
        let _dispatcher = HandlerFactory::create_default_dispatcher();
        // 只要能创建即可（内部有 4 个 handler）
    }

    #[test]
    fn test_registry_custom_register() {
        let mut reg = HandlerRegistry::new();
        reg.register(HandlerMeta {
            name: "custom".into(),
            description: "自定义".into(),
            handled_events: vec!["custom_event".into()],
            enabled: true,
            call_count: 0,
        });
        assert_eq!(reg.list().len(), 1);
        assert!(reg.get("custom").is_some());
    }
}
