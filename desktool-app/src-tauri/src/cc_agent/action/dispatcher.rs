// action/dispatcher.rs — Action 分发器
// 对齐 cc-gui AnAction 事件分发框架

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use super::types::{ActionKind, ActionRequest, ActionResult, ActionStatus};
use super::middleware::MiddlewareChain;
use super::pipeline::ActionPipeline;

/// Action 处理器 trait
#[async_trait::async_trait]
pub trait ActionHandler: Send + Sync {
    /// 处理器支持哪些 ActionKind
    fn handles(&self) -> Vec<ActionKind>;

    /// 执行 action
    async fn execute(&self, request: ActionRequest) -> ActionResult;
}

/// Action 分发器
pub struct ActionDispatcher {
    handlers: HashMap<ActionKind, Vec<Arc<dyn ActionHandler>>>,
    middleware: MiddlewareChain,
    pipelines: Vec<Box<dyn ActionPipeline>>,
}

impl ActionDispatcher {
    pub fn new() -> Self {
        Self {
            handlers: HashMap::new(),
            middleware: MiddlewareChain::default(),
            pipelines: Vec::new(),
        }
    }

    /// 注册处理器
    pub fn register_handler(&mut self, handler: Arc<dyn ActionHandler>) {
        for kind in handler.handles() {
            self.handlers.entry(kind).or_default().push(Arc::clone(&handler));
        }
    }

    /// 注册中间件
    pub fn register_middleware(&mut self, middleware: Box<dyn super::middleware::Middleware>) {
        self.middleware.register(middleware);
    }

    /// 注册管道
    pub fn register_pipeline(&mut self, pipeline: Box<dyn ActionPipeline>) {
        self.pipelines.push(pipeline);
    }

    /// 分发 action（同步版本）
    pub async fn dispatch(&self, request: ActionRequest) -> ActionResult {
        let start = Instant::now();

        // 1. 中间件前置处理
        let request = match self.middleware.execute_before(request).await {
            Ok(req) => req,
            Err(result) => return result,
        };

        // 2. 管道预处理
        let request = self.execute_pipelines_before(request).await;

        // 3. 查找处理器并执行
        let mut result = match self.handlers.get(&request.kind) {
            Some(handlers) if !handlers.is_empty() => {
                handlers[0].execute(request.clone()).await
            }
            _ => {
                ActionResult::err(
                    request.id.clone(),
                    format!("No handler registered for action {:?}", request.kind),
                    start.elapsed(),
                )
            }
        };

        // 4. 管道后处理
        result = self.execute_pipelines_after(&request, result).await;

        // 5. 中间件后置处理
        self.middleware.execute_after(&request, result).await
    }

    /// 分发 batch actions
    pub async fn dispatch_batch(&self, requests: Vec<ActionRequest>) -> Vec<ActionResult> {
        let mut results = Vec::with_capacity(requests.len());
        for request in requests {
            results.push(self.dispatch(request).await);
        }
        results
    }

    /// 获取已注册的 action 类型
    pub fn registered_kinds(&self) -> Vec<ActionKind> {
        let mut kinds: Vec<ActionKind> = self.handlers.keys().cloned().collect();
        kinds.sort_by_key(|k| format!("{:?}", k));
        kinds
    }

    async fn execute_pipelines_before(&self, request: ActionRequest) -> ActionRequest {
        let mut req = request;
        for pipeline in &self.pipelines {
            req = pipeline.before(req).await;
        }
        req
    }

    async fn execute_pipelines_after(
        &self,
        request: &ActionRequest,
        result: ActionResult,
    ) -> ActionResult {
        let mut res = result;
        for pipeline in &self.pipelines {
            res = pipeline.after(request, res).await;
        }
        res
    }
}

impl Default for ActionDispatcher {
    fn default() -> Self {
        Self::new()
    }
}

// ─── 工厂函数 ──────────────────────────────────────────────────────────────────

/// 创建默认的 ActionDispatcher（带内置中间件）
pub fn create_default_dispatcher() -> ActionDispatcher {
    let mut dispatcher = ActionDispatcher::new();
    dispatcher.register_middleware(Box::new(super::middleware::LoggingMiddleware));
    dispatcher.register_middleware(Box::new(super::middleware::TimeoutMiddleware));
    dispatcher
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestHandler;
    #[async_trait::async_trait]
    impl ActionHandler for TestHandler {
        fn handles(&self) -> Vec<ActionKind> {
            vec![ActionKind::Noop]
        }
        async fn execute(&self, request: ActionRequest) -> ActionResult {
            ActionResult::ok(
                request.id,
                Some(serde_json::json!({"handled": true})),
                std::time::Duration::from_millis(1),
            )
        }
    }

    #[tokio::test]
    async fn test_dispatch() {
        let mut dispatcher = ActionDispatcher::new();
        dispatcher.register_handler(Arc::new(TestHandler));

        let request = ActionRequest {
            kind: ActionKind::Noop,
            ..Default::default()
        };

        let result = dispatcher.dispatch(request).await;
        assert!(result.is_success());
        assert_eq!(result.data.unwrap()["handled"], true);
    }

    #[tokio::test]
    async fn test_no_handler() {
        let dispatcher = ActionDispatcher::new();
        let request = ActionRequest {
            kind: ActionKind::Custom("unknown".into()),
            ..Default::default()
        };

        let result = dispatcher.dispatch(request).await;
        assert!(!result.is_success());
    }

    #[tokio::test]
    async fn test_registered_kinds() {
        let mut dispatcher = ActionDispatcher::new();
        dispatcher.register_handler(Arc::new(TestHandler));
        let kinds = dispatcher.registered_kinds();
        assert!(kinds.contains(&ActionKind::Noop));
    }
}
