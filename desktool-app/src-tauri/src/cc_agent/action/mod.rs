// action/mod.rs — Action 处理器框架入口
// Sprint W3: 22 文件 / 对齐 cc-gui AnAction 框架模式

pub mod types;
pub mod middleware;
pub mod dispatcher;
pub mod pipeline;
pub mod handlers;

pub use types::{ActionKind, ActionRequest, ActionResult, ActionStatus, ActionPriority};
pub use dispatcher::{ActionDispatcher, ActionHandler, create_default_dispatcher};
pub use middleware::{Middleware, MiddlewareChain, MiddlewareResult, LoggingMiddleware, TimeoutMiddleware};
pub use pipeline::{ActionPipeline, MetricsPipeline, ValidationPipeline, ErrorRecoveryPipeline, RateLimitPipeline};
pub use handlers::{register_all};
