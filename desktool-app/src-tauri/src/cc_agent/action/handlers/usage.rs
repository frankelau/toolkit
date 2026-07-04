// action/handlers/usage.rs
use async_trait::async_trait;
use crate::cc_agent::action::dispatcher::ActionHandler;
use crate::cc_agent::action::types::{ActionKind, ActionRequest, ActionResult};
pub struct UsageHandler;
#[async_trait]
impl ActionHandler for UsageHandler {
    fn handles(&self) -> Vec<ActionKind> { vec![ActionKind::ConvertCodex, ActionKind::Rewind, ActionKind::PlanResponse, ActionKind::AskUserResponse] }
    async fn execute(&self, request: ActionRequest) -> ActionResult {
        let start = std::time::Instant::now();
        ActionResult::ok(request.id, Some(serde_json::json!({"handler": "usage", "delegated": true})), start.elapsed())
    }
}
