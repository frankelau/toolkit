// action/handlers/diff.rs
use async_trait::async_trait;
use crate::cc_agent::action::dispatcher::ActionHandler;
use crate::cc_agent::action::types::{ActionKind, ActionRequest, ActionResult};
pub struct DiffHandler;
#[async_trait]
impl ActionHandler for DiffHandler {
    fn handles(&self) -> Vec<ActionKind> { vec![ActionKind::GetFileDiff, ActionKind::UndoFile] }
    async fn execute(&self, request: ActionRequest) -> ActionResult {
        let start = std::time::Instant::now();
        ActionResult::ok(request.id, Some(serde_json::json!({"handler": "diff", "delegated": true})), start.elapsed())
    }
}
