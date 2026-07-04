// handler/mod.rs — 消息分发框架
// Sprint S2: 对齐 cc-gui 的 MessageDispatcher + HandlerContext 架构
//
// cc-gui (Java): MessageDispatcher 路由消息到各 Handler
// ccagent (Rust): MessageDispatcher trait + 各 handler 模块
//
// 模块结构：
// - mod.rs     — MessageDispatcher trait + HandlerContext + 注册表
// - file.rs    — 文件操作 handler
// - history.rs — 历史会话 handler
// - diff.rs    — Diff 计算 handler
// - context.rs — 上下文用量 handler

pub mod file;
pub mod history;
pub mod diff;
pub mod context;
pub mod core;

use std::sync::Arc;
use tokio::sync::Mutex;
use std::collections::HashMap;

use crate::cc_agent::provider::ProviderEvent;
use crate::cc_agent::types::Engine;

// ─── HandlerContext ────────────────────────────────────────────────────────

/// Handler 上下文 — 在消息分发过程中传递的共享状态
pub struct HandlerContext {
    /// 会话 ID
    pub session_id: String,
    /// 引擎类型
    pub engine: Engine,
    /// 工作目录
    pub cwd: String,
    /// 当前消息历史（只读快照）
    pub messages: Vec<serde_json::Value>,
    /// 文件变更追踪
    pub file_changes: Mutex<Vec<FileChangeRecord>>,
    /// 事件计数器
    pub event_counts: Mutex<EventCounts>,
}

/// 文件变更记录
#[derive(Debug, Clone, serde::Serialize)]
pub struct FileChangeRecord {
    pub path: String,
    pub change_type: FileChangeType,
    pub tool_use_id: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, serde::Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FileChangeType {
    Created,
    Modified,
    Deleted,
    Renamed,
}

/// 事件计数统计
#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct EventCounts {
    pub content_deltas: u64,
    pub thinking_deltas: u64,
    pub tool_uses: u64,
    pub tool_results: u64,
    pub errors: u64,
    pub usage_updates: u64,
}

impl HandlerContext {
    pub fn new(session_id: String, engine: Engine, cwd: String) -> Self {
        Self {
            session_id,
            engine,
            cwd,
            messages: Vec::new(),
            file_changes: Mutex::new(Vec::new()),
            event_counts: Mutex::new(EventCounts::default()),
        }
    }

    /// 记录文件变更
    pub async fn record_file_change(&self, record: FileChangeRecord) {
        let mut changes = self.file_changes.lock().await;
        changes.push(record);
    }

    /// 获取所有文件变更
    pub async fn get_file_changes(&self) -> Vec<FileChangeRecord> {
        self.file_changes.lock().await.clone()
    }

    /// 递增事件计数
    pub async fn increment_count(&self, event_type: &str) {
        let mut counts = self.event_counts.lock().await;
        match event_type {
            "content_delta" => counts.content_deltas += 1,
            "thinking_delta" => counts.thinking_deltas += 1,
            "tool_use" => counts.tool_uses += 1,
            "tool_result" => counts.tool_results += 1,
            "error" => counts.errors += 1,
            "usage" => counts.usage_updates += 1,
            _ => {}
        }
    }
}

// ─── MessageDispatcher trait ───────────────────────────────────────────────

/// 消息分发器接口
///
/// 每个 Handler 负责处理特定类型的 Provider 事件。
/// MessageDispatcher 负责把事件路由到对应的 Handler。
#[async_trait::async_trait]
pub trait MessageHandler: Send + Sync {
    /// Handler 名称（用于日志）
    fn name(&self) -> &'static str;

    /// 处理事件
    ///
    /// 返回 true 表示已处理（后续 handler 跳过），false 表示未处理（继续分发）
    async fn handle(&self, event: &ProviderEvent, ctx: &HandlerContext) -> bool;
}

/// 消息分发器
///
/// 按注册顺序遍历所有 handler，第一个返回 true 的 handler 处理事件。
/// 对应 cc-gui 的 MessageDispatcher。
pub struct MessageDispatcher {
    handlers: Vec<Box<dyn MessageHandler>>,
}

impl MessageDispatcher {
    pub fn new() -> Self {
        Self { handlers: Vec::new() }
    }

    /// 注册 handler（按调用顺序）
    pub fn register<H: MessageHandler + 'static>(&mut self, handler: H) {
        self.handlers.push(Box::new(handler));
    }

    /// 分发事件到所有 handler
    ///
    /// 遍历所有注册的 handler，第一个返回 true 的处理事件。
    /// 同时更新事件计数。
    pub async fn dispatch(&self, event: &ProviderEvent, ctx: &HandlerContext) {
        // 更新计数
        let event_type = match event {
            ProviderEvent::ContentDelta { .. } => "content_delta",
            ProviderEvent::ThinkingDelta { .. } => "thinking_delta",
            ProviderEvent::ToolUse { .. } => "tool_use",
            ProviderEvent::ToolResult { .. } => "tool_result",
            ProviderEvent::Error { .. } => "error",
            ProviderEvent::Usage { .. } => "usage",
            _ => "",
        };
        if !event_type.is_empty() {
            ctx.increment_count(event_type).await;
        }

        // 分发到 handlers
        for handler in &self.handlers {
            if handler.handle(event, ctx).await {
                break;
            }
        }
    }

    /// 创建默认的分发器（注册所有内置 handler）
    pub fn with_default_handlers() -> Self {
        let mut dispatcher = Self::new();
        dispatcher.register(file::FileHandler::new());
        dispatcher.register(history::HistoryHandler::new());
        dispatcher.register(diff::DiffHandler::new());
        dispatcher.register(context::ContextHandler::new());
        dispatcher
    }
}

impl Default for MessageDispatcher {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Handler 工厂 ──────────────────────────────────────────────────────────

/// 创建带默认 handler 的 Arc<MessageDispatcher>
pub fn create_default_dispatcher() -> Arc<MessageDispatcher> {
    Arc::new(MessageDispatcher::with_default_handlers())
}
