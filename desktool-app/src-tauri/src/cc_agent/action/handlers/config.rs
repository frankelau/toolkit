// action/handlers/config.rs
use async_trait::async_trait;
use crate::cc_agent::action::dispatcher::ActionHandler;
use crate::cc_agent::action::types::{ActionKind, ActionRequest, ActionResult};
pub struct ConfigHandler;
#[async_trait]
impl ActionHandler for ConfigHandler {
    fn handles(&self) -> Vec<ActionKind> { vec![ActionKind::GetSettings, ActionKind::SaveSettings, ActionKind::GetProjectConfig, ActionKind::SaveProjectConfig, ActionKind::ListSkills, ActionKind::CreateSkill, ActionKind::DeleteSkill, ActionKind::ImportSkill, ActionKind::EnableSkill, ActionKind::DisableSkill, ActionKind::ListMcpServers, ActionKind::AddMcpServer, ActionKind::RemoveMcpServer, ActionKind::GetMcpTools] }
    async fn execute(&self, request: ActionRequest) -> ActionResult {
        let start = std::time::Instant::now();
        ActionResult::ok(request.id, Some(serde_json::json!({"handler": "config", "delegated": true})), start.elapsed())
    }
}
