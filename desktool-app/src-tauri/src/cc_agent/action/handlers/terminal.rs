// action/handlers/terminal.rs
use async_trait::async_trait;
use crate::cc_agent::action::dispatcher::ActionHandler;
use crate::cc_agent::action::types::{ActionKind, ActionRequest, ActionResult};
pub struct TerminalHandler;
#[async_trait]
impl ActionHandler for TerminalHandler {
    fn handles(&self) -> Vec<ActionKind> { vec![ActionKind::ExecuteTerminal, ActionKind::StartTerminal, ActionKind::KillTerminal] }
    async fn execute(&self, request: ActionRequest) -> ActionResult {
        let start = std::time::Instant::now();
        ActionResult::ok(request.id, Some(serde_json::json!({"handler": "terminal", "delegated": true})), start.elapsed())
    }
}
