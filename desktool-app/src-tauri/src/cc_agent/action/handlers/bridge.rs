// action/handlers/bridge.rs
use async_trait::async_trait;
use crate::cc_agent::action::dispatcher::ActionHandler;
use crate::cc_agent::action::types::{ActionKind, ActionRequest, ActionResult};
pub struct BridgeHandler;
#[async_trait]
impl ActionHandler for BridgeHandler {
    fn handles(&self) -> Vec<ActionKind> { vec![ActionKind::EnsureBridge, ActionKind::BridgeHealth, ActionKind::BridgeCommand] }
    async fn execute(&self, request: ActionRequest) -> ActionResult {
        let start = std::time::Instant::now();
        ActionResult::ok(request.id, Some(serde_json::json!({"handler": "bridge", "delegated": true})), start.elapsed())
    }
}
