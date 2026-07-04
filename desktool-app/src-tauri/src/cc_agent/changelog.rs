// changelog.rs — 更新日志
// Sprint L: 从 cc_agent.rs 拆分

/// 读取版本日志
#[tauri::command]
pub async fn cc_get_changelog() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "changes": [
            { "version": "0.1.0", "date": "2026-07-01", "items": ["初始版本", "CC Agent 模块化", "MCP 可视化管理", "Sprint A-F 完成"] },
            { "version": "0.2.0", "date": "2026-07-02", "items": ["Sprint G: CcAgent.tsx 迁移到 Context+Hook", "Sprint H: utils + types 拆分", "Sprint I: 缺失 hooks 补齐 45 个", "Sprint J: 缺失组件补齐 13 个", "Sprint K: settings 子目录补齐", "Sprint L: 后端模块化拆分"] }
        ]
    }))
}
