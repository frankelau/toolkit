// action/handlers/context.rs
use async_trait::async_trait;
use crate::cc_agent::action::dispatcher::ActionHandler;
use crate::cc_agent::action::types::{ActionKind, ActionRequest, ActionResult};
pub struct ContextHandler;
#[async_trait]
impl ActionHandler for ContextHandler {
    fn handles(&self) -> Vec<ActionKind> { vec![ActionKind::GetHistory, ActionKind::GetContextUsage, ActionKind::SearchSessions] }
    async fn execute(&self, request: ActionRequest) -> ActionResult {
        let start = std::time::Instant::now();
        ActionResult::ok(request.id, Some(serde_json::json!({"handler": "context", "delegated": true})), start.elapsed())
    }
}
