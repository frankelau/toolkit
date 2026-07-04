// action/handlers/mod.rs — Action 处理器注册中心

pub mod tool;
pub mod message;
pub mod file;
pub mod permission;
pub mod terminal;
pub mod context;
pub mod diff;
pub mod stream;
pub mod session;
pub mod bridge;
pub mod cache;
pub mod search;
pub mod config;
pub mod usage;
pub mod error;
pub mod noop;

use std::sync::Arc;
use super::dispatcher::{ActionDispatcher, ActionHandler};
use super::types::{ActionKind, ActionRequest, ActionResult};

/// 向分发器注册所有内置处理器
pub fn register_all(dispatcher: &mut ActionDispatcher) {
    dispatcher.register_handler(Arc::new(tool::ToolHandler));
    dispatcher.register_handler(Arc::new(message::MessageHandler));
    dispatcher.register_handler(Arc::new(file::FileHandler));
    dispatcher.register_handler(Arc::new(permission::PermissionHandler));
    dispatcher.register_handler(Arc::new(terminal::TerminalHandler));
    dispatcher.register_handler(Arc::new(context::ContextHandler));
    dispatcher.register_handler(Arc::new(diff::DiffHandler));
    dispatcher.register_handler(Arc::new(stream::StreamHandler));
    dispatcher.register_handler(Arc::new(session::SessionHandler));
    dispatcher.register_handler(Arc::new(bridge::BridgeHandler));
    dispatcher.register_handler(Arc::new(cache::CacheHandler));
    dispatcher.register_handler(Arc::new(search::SearchHandler));
    dispatcher.register_handler(Arc::new(config::ConfigHandler));
    dispatcher.register_handler(Arc::new(usage::UsageHandler));
    dispatcher.register_handler(Arc::new(error::ErrorHandler));
    dispatcher.register_handler(Arc::new(noop::NoopHandler));
}
