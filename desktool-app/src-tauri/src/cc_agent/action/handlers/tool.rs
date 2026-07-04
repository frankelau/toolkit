// action/handlers/tool.rs — 工具调用处理器
use async_trait::async_trait;
use crate::cc_agent::action::dispatcher::ActionHandler;
use crate::cc_agent::action::types::{ActionKind, ActionRequest, ActionResult};

pub struct ToolHandler;

#[async_trait]
impl ActionHandler for ToolHandler {
    fn handles(&self) -> Vec<ActionKind> {
        vec![ActionKind::ExecuteToolCall, ActionKind::ApproveToolCall, ActionKind::RejectToolCall]
    }

    async fn execute(&self, request: ActionRequest) -> ActionResult {
        let start = std::time::Instant::now();
        match request.kind {
            ActionKind::ExecuteToolCall => {
                ActionResult::ok(request.id, Some(serde_json::json!({
                    "action": "execute_tool",
                    "status": "delegated",
                    "note": "Tool execution handled by session streaming layer"
                })), start.elapsed())
            }
            ActionKind::ApproveToolCall => {
                ActionResult::ok(request.id, Some(serde_json::json!({
                    "action": "approve_tool",
                    "approved": true
                })), start.elapsed())
            }
            ActionKind::RejectToolCall => {
                ActionResult::ok(request.id, Some(serde_json::json!({
                    "action": "reject_tool",
                    "approved": false
                })), start.elapsed())
            }
            _ => ActionResult::err(request.id, "Unhandled action".into(), start.elapsed()),
        }
    }
}
