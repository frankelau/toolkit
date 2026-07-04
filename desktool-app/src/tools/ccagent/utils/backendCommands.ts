// backendCommands.ts — 统一的后端 Tauri 命令调用包装器
// 为 Sprint Final F1 创建的 handler 命令提供前端调用入口

import { invoke } from "@tauri-apps/api/core";

// ─── Session / History ──────────────────────────────────────────────────────

export async function searchSessions(query: string) {
  return invoke<any>("cc_search_sessions", { query });
}

export async function getSessionStats() {
  return invoke<any>("cc_get_session_stats");
}

export async function getSessionStatus(sessionId: string) {
  return invoke<any>("cc_get_session_status", { sessionId });
}

export async function deleteSessionById(sessionId: string) {
  return invoke<any>("cc_delete_session_by_id", { sessionId });
}

export async function refreshSessionIndex() {
  return invoke<any>("cc_refresh_session_index");
}

export async function sessionHealth(sessionId: string) {
  return invoke<any>("cc_session_health", { sessionId });
}

// ─── Settings ───────────────────────────────────────────────────────────────

export async function getSettings() {
  return invoke<any>("cc_get_settings");
}

export async function saveSettings(settings: Record<string, unknown>) {
  return invoke<any>("cc_save_settings", { settings });
}

export async function getAppearance() {
  return invoke<Record<string, unknown>>("cc_get_appearance");
}

export async function saveAppearance(appearance: Record<string, unknown>) {
  return invoke("cc_save_appearance", { appearance });
}

export async function getNotificationSettings() {
  return invoke<Record<string, unknown>>("cc_get_notification_settings");
}

export async function saveNotificationSettings(settings: Record<string, unknown>) {
  return invoke("cc_save_notification_settings", { settings });
}

export async function getProviderSettings() {
  return invoke<Record<string, unknown>>("cc_get_provider_settings");
}

export async function saveProviderSettings(settings: Record<string, unknown>) {
  return invoke("cc_save_provider_settings", { settings });
}

export async function getProjectConfig() {
  return invoke<Record<string, unknown>>("cc_get_project_config");
}

export async function saveProjectConfig(config: Record<string, unknown>) {
  return invoke("cc_save_project_config", { config });
}

export async function getPermissionSettings() {
  return invoke<Record<string, unknown>>("cc_get_permission_settings");
}

export async function savePermissionSettings(settings: Record<string, unknown>) {
  return invoke("cc_save_permission_settings", { settings });
}

export async function getPermissionMode() {
  return invoke<string>("cc_get_permission_mode");
}

export async function setPermissionMode(mode: string) {
  return invoke("cc_set_permission_mode", { mode });
}

// ─── Usage Stats ────────────────────────────────────────────────────────────

export async function getUsageStats() {
  return invoke<any>("cc_get_usage_stats");
}

export async function pushUsageRecord(record: Record<string, unknown>) {
  return invoke("cc_push_usage_record", { record });
}

export async function resetUsageStats() {
  return invoke("cc_reset_usage_stats");
}

// ─── Skills ─────────────────────────────────────────────────────────────────

export async function listAllSkills() {
  return invoke<any>("cc_list_all_skills");
}

export async function getSkillMetadata(name: string) {
  return invoke<any>("cc_get_skill_metadata", { name });
}

export async function toggleSkill(name: string) {
  return invoke<any>("cc_toggle_skill", { name });
}

export async function enableSkill(name: string) {
  return invoke<any>("cc_enable_skill", { name });
}

export async function disableSkill(name: string) {
  return invoke<any>("cc_disable_skill", { name });
}

export async function importSkill(filePath: string) {
  return invoke<any>("cc_import_skill", { filePath });
}

// ─── MCP ────────────────────────────────────────────────────────────────────

export async function addMcpServer(server: Record<string, unknown>) {
  return invoke("cc_add_mcp_server", { server });
}

export async function removeMcpServer(id: string) {
  return invoke("cc_remove_mcp_server", { id });
}

export async function listProviderPresets() {
  return invoke<any>("cc_list_provider_presets");
}

// ─── Permission ─────────────────────────────────────────────────────────────

export async function listPendingPermissions() {
  return invoke<any>("cc_list_pending_permissions");
}

export async function removePermissionSession(sessionId: string) {
  return invoke("cc_remove_permission_session", { sessionId });
}

export async function clearPermissionMemory() {
  return invoke("cc_clear_permission_memory");
}

export async function respondPermission(sessionId: string, grant: boolean) {
  return invoke("cc_respond_permission", { sessionId, grant });
}

// ─── Input History ──────────────────────────────────────────────────────────

export async function getInputHistory() {
  return invoke<string[]>("cc_get_input_history");
}

export async function addInputHistory(line: string) {
  return invoke("cc_add_input_history", { line });
}

export async function clearInputHistory() {
  return invoke("cc_clear_input_history");
}

// ─── Terminal ───────────────────────────────────────────────────────────────

export async function startTerminal(cwd?: string) {
  return invoke<any>("cc_start_terminal", { cwd });
}

export async function listTerminals() {
  return invoke<any>("cc_list_terminals");
}

export async function killTerminal(id: string) {
  return invoke("cc_kill_terminal", { id });
}

export async function executeTerminalCommand(id: string, cmd: string) {
  return invoke("cc_execute_terminal_command", { id, cmd });
}

// ─── Session Management ─────────────────────────────────────────────────────

export async function listTabs() {
  return invoke<any>("cc_list_tabs");
}

export async function switchTab(sessionId: string) {
  return invoke("cc_switch_tab", { sessionId });
}

export async function startSessionWatcher() {
  return invoke("cc_start_session_watcher");
}

export async function stopSessionWatcher() {
  return invoke("cc_stop_session_watcher");
}

// ─── Conversion ─────────────────────────────────────────────────────────────

export async function convertFromCodexFormat(data: string) {
  return invoke<any>("cc_convert_from_codex_format", { data });
}

export async function convertToCodexFormat(data: string) {
  return invoke<any>("cc_convert_to_codex_format", { data });
}

// ─── Prompt Templates ───────────────────────────────────────────────────────

export async function savePromptTemplate(name: string, template: string) {
  return invoke("cc_save_prompt_template", { name, template });
}

export async function deletePromptTemplate(name: string) {
  return invoke("cc_delete_prompt_template", { name });
}

// ─── Cache ──────────────────────────────────────────────────────────────────

export async function checkDependencies() {
  return invoke<any>("cc_check_dependencies");
}

export async function clearCaches() {
  return invoke("cc_clear_caches");
}

export async function cacheStats() {
  return invoke<any>("cc_cache_stats");
}

// ─── Changelog ──────────────────────────────────────────────────────────────

export async function getChangelog() {
  return invoke<any>("cc_get_changelog");
}

// ─── Handler Utilities (Sprint Final F1) ────────────────────────────────────

export async function buildFileTree(root: string, maxDepth?: number) {
  return invoke<any>("cc_build_file_tree", { root, maxDepth });
}

export async function collectWorkspaceContext(cwd: string) {
  return invoke<any>("cc_collect_workspace_context", { cwd });
}

export async function computeLineDiff(oldText: string, newText: string) {
  return invoke<any>("cc_compute_line_diff", { oldText, newText });
}

export async function diffTexts(oldText: string, newText: string) {
  return invoke<any>("cc_diff_texts", { oldText, newText });
}

export async function getFileDiff(filePath: string) {
  return invoke<any>("cc_get_file_diff", { filePath });
}

export async function listHandlers() {
  return invoke<any>("cc_list_handlers");
}

export async function getDirectoryStats(dir: string) {
  return invoke<any>("cc_get_directory_stats", { dir });
}

// ─── Permission v2 ──────────────────────────────────────────────────────────

export async function setPermissionModeV2(mode: string, sessionId?: string) {
  return invoke("cc_set_permission_mode_v2", { mode, sessionId });
}

// ─── Session History ────────────────────────────────────────────────────────

export async function getHistory(sessionId: string) {
  return invoke<any>("cc_get_history", { sessionId });
}
