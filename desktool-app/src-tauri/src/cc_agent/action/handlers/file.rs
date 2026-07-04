// action/handlers/file.rs
use async_trait::async_trait;
use crate::cc_agent::action::dispatcher::ActionHandler;
use crate::cc_agent::action::types::{ActionKind, ActionRequest, ActionResult};

pub struct FileHandler;
#[async_trait]
impl ActionHandler for FileHandler {
    fn handles(&self) -> Vec<ActionKind> { vec![ActionKind::ListFiles, ActionKind::ReadFile, ActionKind::GetFileDiff, ActionKind::UndoFile, ActionKind::DiscardFiles] }
    async fn execute(&self, request: ActionRequest) -> ActionResult {
        let start = std::time::Instant::now();
        ActionResult::ok(request.id, Some(serde_json::json!({"handler": "file", "delegated": true})), start.elapsed())
    }
}
