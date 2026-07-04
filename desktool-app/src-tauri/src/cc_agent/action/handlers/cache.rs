// action/handlers/cache.rs
use async_trait::async_trait;
use crate::cc_agent::action::dispatcher::ActionHandler;
use crate::cc_agent::action::types::{ActionKind, ActionRequest, ActionResult};
pub struct CacheHandler;
#[async_trait]
impl ActionHandler for CacheHandler {
    fn handles(&self) -> Vec<ActionKind> { vec![ActionKind::ClearCache, ActionKind::CacheStats] }
    async fn execute(&self, request: ActionRequest) -> ActionResult {
        let start = std::time::Instant::now();
        ActionResult::ok(request.id, Some(serde_json::json!({"handler": "cache", "delegated": true})), start.elapsed())
    }
}
