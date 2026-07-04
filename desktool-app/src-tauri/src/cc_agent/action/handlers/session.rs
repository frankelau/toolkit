// action/handlers/session.rs
use async_trait::async_trait;
use crate::cc_agent::action::dispatcher::ActionHandler;
use crate::cc_agent::action::types::{ActionKind, ActionRequest, ActionResult};
pub struct SessionHandler;
#[async_trait]
impl ActionHandler for SessionHandler {
    fn handles(&self) -> Vec<ActionKind> { vec![ActionKind::StartSession, ActionKind::SendMessage, ActionKind::AbortSession, ActionKind::SwitchTab, ActionKind::ListTabs] }
    async fn execute(&self, request: ActionRequest) -> ActionResult {
        let start = std::time::Instant::now();
        ActionResult::ok(request.id, Some(serde_json::json!({"handler": "session", "delegated": true})), start.elapsed())
    }
}
