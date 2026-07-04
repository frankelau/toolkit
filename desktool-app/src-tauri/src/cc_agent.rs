// cc_agent.rs — CC Agent 后端模块入口
// Sprint L: 从 1734 行单文件拆分为 13 个子模块
// 本文件只做模块声明 + pub use 再导出，保持 lib.rs 的导入不变

mod types;
mod bridge;
mod session;
mod file_ops;
mod history;
pub mod skill;
mod provider;
mod prompt;
mod settings;
mod usage;
mod dependency;
mod rewind;
mod codex;
mod changelog;

// Sprint S: provider trait 抽象 + handler 框架 + cache/watcher/terminal
pub mod handler;
pub mod cache;
pub mod watcher;
pub mod terminal;

// Sprint W2: util/ 工具类目录
pub mod util;

// Sprint V1: permission 审批系统
pub mod permission;

// Sprint W3: action/ 处理器框架
pub mod action;

// network 请求日志
pub mod network;

// Sprint Final F4: model/ 数据模型层
pub mod model;

// Sprint B3: bridge_commands 前端桥接命令
pub mod bridge_commands;

// Sprint B4: SDK 自动检测 + 下载安装
pub mod dependency_sdk;

// Sprint B5: Git 提交消息 + 交互式Diff + Provider 导入导出
pub mod git;

// ─── 类型再导出 ──────────────────────────────────────────────────────────────
pub use types::{Engine, SessionConfig, Attachment, Session, SessionManager, FileEntry, DependencyInfo};

// ─── bridge ─────────────────────────────────────────────────────────────────
pub use bridge::{ensure_bridge, cc_ensure_bridge};

// ─── session 生命周期 ─────────────────────────────────────────────────────────
pub use session::{
    cc_start_session, cc_send_message, cc_abort_session, cc_get_history,
    cc_permission_response, cc_get_context_usage, cc_set_permission_mode,
    cc_get_session_status, cc_list_tabs, cc_switch_tab, cc_enhance_prompt,
    cc_session_health,
};

// ─── 文件操作 ─────────────────────────────────────────────────────────────────
pub use file_ops::{cc_list_files, cc_read_file, cc_get_file_diff, cc_undo_file, cc_discard_all_files};

// ─── 历史会话 ─────────────────────────────────────────────────────────────────
pub use history::{cc_list_claude_sessions, cc_refresh_session_index, cc_search_sessions};

// ─── Skills ──────────────────────────────────────────────────────────────────
pub use skill::{
    cc_list_skills, cc_list_all_skills, cc_create_skill, cc_delete_skill,
    cc_import_skill, cc_enable_skill, cc_disable_skill,
    cc_toggle_skill, cc_get_skill_metadata,
};

// ─── MCP Provider ────────────────────────────────────────────────────────────
pub use provider::{cc_list_mcp_servers, cc_add_mcp_server, cc_remove_mcp_server, cc_get_mcp_tools};
// Sprint Final F2: ProviderRuntime 注册到 app state
pub use provider::create_runtime as create_provider_runtime;

// ─── Prompt 模板 ──────────────────────────────────────────────────────────────
pub use prompt::{cc_list_prompt_templates, cc_save_prompt_template, cc_delete_prompt_template};

// ─── 设置 + 项目配置 ──────────────────────────────────────────────────────────
pub use settings::{cc_get_settings, cc_save_settings, cc_get_project_config, cc_save_project_config};

// ─── 使用统计 + 输入历史 ──────────────────────────────────────────────────────
pub use usage::{
    cc_get_usage_stats, cc_push_usage_record, cc_reset_usage_stats,
    cc_get_input_history, cc_add_input_history, cc_clear_input_history,
};

// ─── 依赖检查 ─────────────────────────────────────────────────────────────────
pub use dependency::{cc_check_engines, cc_check_dependencies};

// ─── 回退/Plan/AskUser ─────────────────────────────────────────────────────────
pub use rewind::{cc_rewind, cc_plan_response, cc_ask_user_response};

// ─── Codex 格式转换 ───────────────────────────────────────────────────────────
pub use codex::{cc_convert_to_codex_format, cc_convert_from_codex_format};

// ─── 更新日志 ─────────────────────────────────────────────────────────────────
pub use changelog::cc_get_changelog;

// ─── Sprint S: cache + watcher + terminal ────────────────────────────────────
pub use cache::{cc_clear_caches, cc_cache_stats};
pub use watcher::{cc_start_session_watcher, cc_stop_session_watcher};
pub use terminal::{
    cc_execute_terminal_command, cc_start_terminal, cc_kill_terminal, cc_list_terminals,
};

// ─── Sprint B3: bridge_commands (57 个桥接命令) ───────────────────────────────
pub use bridge_commands::{
    BridgeState,
    // Streaming/Thinking
    cc_get_streaming_enabled, cc_set_streaming_enabled,
    cc_get_thinking_enabled, cc_set_thinking_enabled,
    // Auto/Send/Sandbox
    cc_get_auto_open_file_enabled, cc_set_auto_open_file_enabled,
    cc_get_send_shortcut, cc_set_send_shortcut,
    cc_get_codex_sandbox_mode, cc_set_codex_sandbox_mode,
    cc_set_codex_fast_mode,
    // Mode/Model/Reasoning
    cc_get_mode, cc_set_mode, cc_set_model, cc_set_reasoning_effort,
    // Permission dialog
    cc_get_permission_dialog_timeout, cc_set_permission_dialog_timeout,
    // Diff/History/Commit/AI
    cc_set_diff_expanded_by_default, cc_set_history_completion_enabled,
    cc_set_commit_generation_enabled, cc_set_ai_title_generation_enabled,
    // Node/CLI paths
    cc_get_node_path, cc_save_node_path,
    cc_get_claude_cli_path, cc_save_claude_cli_path,
    cc_get_working_directory, cc_save_working_directory,
    cc_get_commit_prompt, cc_save_commit_prompt, cc_save_project_commit_prompt,
    // File ops
    cc_open_file, cc_open_external_url, cc_resolve_file_path,
    // Node processes
    cc_get_node_processes, cc_kill_node_process, cc_kill_all_orphans, cc_restart_node_daemon,
    // Codex subscription
    cc_get_codex_subscription_quota,
    // Dependencies
    cc_get_dependency_status,
    // Deep search
    cc_deep_search_history,
    // MCP
    cc_toggle_mcp_server,
    // Provider CRUD
    cc_get_providers, cc_add_provider, cc_update_provider, cc_delete_provider,
    cc_get_active_provider, cc_set_provider, cc_switch_provider,
    // Agent CRUD
    cc_get_agents, cc_add_agent, cc_update_agent, cc_delete_agent,
    cc_get_selected_agent, cc_set_selected_agent,
    // Prompt CRUD
    cc_get_prompts, cc_add_prompt, cc_update_prompt, cc_delete_prompt,
};

// ─── Sprint B4: SDK 检测 + 安装 ──────────────────────────────────────────────
pub use dependency_sdk::{
    SdkManagerState,
    cc_check_node_environment, cc_get_all_sdk_status,
    cc_is_sdk_installed, cc_get_sdk_version,
    cc_install_sdk, cc_uninstall_sdk, cc_get_install_progress,
};

pub use handler::core::{
    cc_build_file_tree, cc_get_directory_stats, cc_diff_texts, cc_compute_line_diff,
    cc_collect_workspace_context, cc_get_session_stats, cc_delete_session_by_id,
    cc_list_handlers,
};

// ─── Sprint B5-1: 交互式Diff ─────────────────────────────────────────────────
pub use handler::diff::{cc_apply_diff_changes, cc_reject_diff_changes};

// ─── Sprint B5-3: Git 提交消息 ───────────────────────────────────────────────
pub use git::{
    cc_generate_commit_message, cc_get_git_status,
    // B9 IDEA级Git管理
    cc_get_git_changes, cc_stage_file, cc_unstage_file, cc_stage_all,
    cc_revert_file, cc_get_git_file_diff, cc_get_git_branches,
    cc_create_branch, cc_checkout_branch, cc_git_commit,
    cc_git_pull, cc_git_push, cc_git_fetch, cc_get_git_log,
};

// ─── Sprint B5-4: 子Agent历史 + 会话导出 + 批量删除 ───────────────────────────
pub use handler::history::{cc_get_subagent_history, cc_export_session, cc_delete_sessions};

// ─── B5-4: Provider 导入/导出 + 排序 ──────────────────────────────────────────
pub use settings::provider::{cc_export_providers, cc_import_providers, cc_reorder_providers};

// ─── Sprint B6: 斜杠命令 + Node检测 + 环境配置 + Codex历史 ──────────────────────
pub use skill::commands::cc_list_slash_commands;
pub use bridge::node_detector::cc_detect_node_installations;
pub use bridge::env_config::cc_configure_bridge_env;
pub use provider::codex::cc_parse_codex_history;

// ─── Sprint B7: 条件Skill + 重放去重 + npm修复 + Bridge解压 + 模型验证 + 最近文件 ─
pub use skill::service::cc_filter_skills_by_context;
pub use session::dedup::cc_deduplicate_messages;
pub use dependency_sdk::cc_fix_npm_permissions;
pub use bridge::deploy::{cc_verify_bridge_integrity, cc_extract_bridge};
pub use provider::model_provider::{cc_verify_api_key, cc_list_available_models};
pub use handler::context::cc_get_recent_files;

// ─── network 请求日志 ─────────────────────────────────────────────────────────
pub use network::{
    NetworkLogState,
    cc_get_network_log, cc_clear_network_log, cc_get_network_stats,
};
