// action/handlers/stream.rs
use async_trait::async_trait;
use crate::cc_agent::action::dispatcher::ActionHandler;
use crate::cc_agent::action::types::{ActionKind, ActionRequest, ActionResult};
pub struct StreamHandler;
#[async_trait]
impl ActionHandler for StreamHandler {
    fn handles(&self) -> Vec<ActionKind> { vec![ActionKind::ProcessStreamLine, ActionKind::ProcessError] }
    async fn execute(&self, request: ActionRequest) -> ActionResult {
        let start = std::time::Instant::now();
        ActionResult::ok(request.id, Some(serde_json::json!({"handler": "stream", "delegated": true})), start.elapsed())
    }
}
