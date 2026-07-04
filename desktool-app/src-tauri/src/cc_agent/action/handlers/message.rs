// action/handlers/message.rs
use async_trait::async_trait;
use crate::cc_agent::action::dispatcher::ActionHandler;
use crate::cc_agent::action::types::{ActionKind, ActionRequest, ActionResult};

pub struct MessageHandler;
#[async_trait]
impl ActionHandler for MessageHandler {
    fn handles(&self) -> Vec<ActionKind> { vec![ActionKind::ProcessMessage, ActionKind::EnhancePrompt, ActionKind::ProcessError] }
    async fn execute(&self, request: ActionRequest) -> ActionResult {
        let start = std::time::Instant::now();
        ActionResult::ok(request.id, Some(serde_json::json!({"handler": "message", "delegated": true})), start.elapsed())
    }
}
