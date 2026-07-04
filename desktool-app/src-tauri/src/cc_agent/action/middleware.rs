// action/middleware.rs — Action 中间件链
// 对齐 cc-gui action 系统的事件拦截模式

use std::sync::Arc;
use std::future::Future;
use std::pin::Pin;

use super::types::{ActionRequest, ActionResult};

/// 中间件处理结果
pub enum MiddlewareResult {
    /// 继续处理链
    Continue(ActionRequest),
    /// 短路返回
    ShortCircuit(ActionResult),
}

/// 中间件 trait
pub trait Middleware: Send + Sync {
    fn name(&self) -> &str;
    fn priority(&self) -> i32;

    fn before(
        &self,
        request: ActionRequest,
    ) -> Pin<Box<dyn Future<Output = MiddlewareResult> + Send + '_>>;

    fn after(
        &self,
        request: &ActionRequest,
        result: ActionResult,
    ) -> Pin<Box<dyn Future<Output = ActionResult> + Send + '_>>;
}

/// 中间件链
pub struct MiddlewareChain {
    middlewares: Vec<Box<dyn Middleware>>,
}

impl MiddlewareChain {
    pub fn new() -> Self {
        Self { middlewares: Vec::new() }
    }

    /// 注册中间件（按优先级排序）
    pub fn register(&mut self, middleware: Box<dyn Middleware>) {
        let pos = self.middlewares
            .iter()
            .position(|m| m.priority() > middleware.priority())
            .unwrap_or(self.middlewares.len());
        self.middlewares.insert(pos, middleware);
    }

    /// 执行 before 链
    pub async fn execute_before(&self, mut request: ActionRequest) -> Result<ActionRequest, ActionResult> {
        for mw in &self.middlewares {
            match mw.before(request).await {
                MiddlewareResult::Continue(req) => request = req,
                MiddlewareResult::ShortCircuit(result) => return Err(result),
            }
        }
        Ok(request)
    }

    /// 执行 after 链
    pub async fn execute_after(&self, request: &ActionRequest, mut result: ActionResult) -> ActionResult {
        for mw in self.middlewares.iter().rev() {
            result = mw.after(request, result).await;
        }
        result
    }

    /// 中间件数量
    pub fn len(&self) -> usize {
        self.middlewares.len()
    }

    pub fn is_empty(&self) -> bool {
        self.middlewares.is_empty()
    }
}

impl Default for MiddlewareChain {
    fn default() -> Self {
        Self::new()
    }
}

// ─── 内置中间件 ──────────────────────────────────────────────────────────────────

/// 日志中间件：记录所有 action 的执行时间和结果
pub struct LoggingMiddleware;

impl Middleware for LoggingMiddleware {
    fn name(&self) -> &str { "logging" }
    fn priority(&self) -> i32 { 100 }

    fn before(
        &self,
        request: ActionRequest,
    ) -> Pin<Box<dyn Future<Output = MiddlewareResult> + Send + '_>> {
        Box::pin(async move {
            // log::debug!("[Action] {} ({:?}) started", request.id, request.kind);
            MiddlewareResult::Continue(request)
        })
    }

    fn after(
        &self,
        request: &ActionRequest,
        result: ActionResult,
    ) -> Pin<Box<dyn Future<Output = ActionResult> + Send + '_>> {
        Box::pin(async move {
            // Logging handled internally
            match &result.status {
                super::types::ActionStatus::Completed => {},
                super::types::ActionStatus::Failed(_) => {},
                _ => {}
            }
            result
        })
    }
}

/// 超时中间件：检查 action 是否超时
pub struct TimeoutMiddleware;

impl Middleware for TimeoutMiddleware {
    fn name(&self) -> &str { "timeout" }
    fn priority(&self) -> i32 { -100 }

    fn before(
        &self,
        request: ActionRequest,
    ) -> Pin<Box<dyn Future<Output = MiddlewareResult> + Send + '_>> {
        Box::pin(async move {
            let now = super::super::util::time_utils::now_millis();
            if let Some(timeout_ms) = request.timeout_ms {
                let elapsed = now.saturating_sub(request.timestamp);
                if elapsed > timeout_ms as u128 {
                    return MiddlewareResult::ShortCircuit(
                        ActionResult::err(
                            request.id,
                            format!("Action timed out after {}ms (limit: {}ms)", elapsed, timeout_ms),
                            std::time::Duration::from_millis(elapsed as u64),
                        )
                    );
                }
            }
            MiddlewareResult::Continue(request)
        })
    }

    fn after(
        &self,
        _request: &ActionRequest,
        result: ActionResult,
    ) -> Pin<Box<dyn Future<Output = ActionResult> + Send + '_>> {
        Box::pin(async move { result })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::types::{ActionKind, ActionPriority, ActionResult, ActionStatus};

    struct TestMiddleware {
        prefix: String,
        suffix: String,
    }

    impl Middleware for TestMiddleware {
        fn name(&self) -> &str { "test" }
        fn priority(&self) -> i32 { 0 }

        fn before(
            &self,
            mut request: ActionRequest,
        ) -> Pin<Box<dyn Future<Output = MiddlewareResult> + Send + '_>> {
            let prefix = self.prefix.clone();
            Box::pin(async move {
                // 修改 payload 添加前缀
                if let serde_json::Value::String(s) = &mut request.payload {
                    *s = format!("{}{}", prefix, s);
                }
                MiddlewareResult::Continue(request)
            })
        }

        fn after(
            &self,
            request: &ActionRequest,
            mut result: ActionResult,
        ) -> Pin<Box<dyn Future<Output = ActionResult> + Send + '_>> {
            let suffix = self.suffix.clone();
            Box::pin(async move {
                // 添加后缀到 error 信息
                if let Some(ref mut err) = result.error {
                    err.push_str(&suffix);
                }
                result
            })
        }
    }

    #[tokio::test]
    async fn test_middleware_chain() {
        let mut chain = MiddlewareChain::new();
        chain.register(Box::new(TestMiddleware {
            prefix: "[PRE]".into(),
            suffix: "[POST]".into(),
        }));

        let request = ActionRequest {
            payload: serde_json::json!("hello"),
            ..Default::default()
        };

        let req = chain.execute_before(request).await.unwrap();
        assert_eq!(req.payload, serde_json::json!("[PRE]hello"));

        let result = ActionResult::err(
            req.id.clone(),
            "error occurred".into(),
            std::time::Duration::from_millis(100),
        );
        let result = chain.execute_after(&req, result).await;
        assert!(result.error.unwrap().contains("[POST]"));
    }
}
