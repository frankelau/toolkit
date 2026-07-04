// action/handlers/noop.rs
use async_trait::async_trait;
use crate::cc_agent::action::dispatcher::ActionHandler;
use crate::cc_agent::action::types::{ActionKind, ActionRequest, ActionResult};
pub struct NoopHandler;
#[async_trait]
impl ActionHandler for NoopHandler {
    fn handles(&self) -> Vec<ActionKind> { vec![ActionKind::Noop] }
    async fn execute(&self, request: ActionRequest) -> ActionResult {
        let start = std::time::Instant::now();
        ActionResult::ok(request.id, Some(serde_json::json!({"handled": true})), start.elapsed())
    }
}
