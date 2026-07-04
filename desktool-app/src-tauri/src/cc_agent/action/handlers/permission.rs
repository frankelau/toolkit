// action/handlers/permission.rs
use async_trait::async_trait;
use crate::cc_agent::action::dispatcher::ActionHandler;
use crate::cc_agent::action::types::{ActionKind, ActionRequest, ActionResult};

pub struct PermissionHandler;
#[async_trait]
impl ActionHandler for PermissionHandler {
    fn handles(&self) -> Vec<ActionKind> { vec![ActionKind::RequestPermission, ActionKind::RespondPermission, ActionKind::SetPermissionMode] }
    async fn execute(&self, request: ActionRequest) -> ActionResult {
        let start = std::time::Instant::now();
        ActionResult::ok(request.id, Some(serde_json::json!({"handler": "permission", "delegated": true})), start.elapsed())
    }
}
