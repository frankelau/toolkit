// toolConstants.ts — 工具相关常量（补充集合分类）
// 注：TOOL_LABELS 和 SAFE_TOOLS 定义在 constants.ts，这里 re-export + 补充分类集合

export { TOOL_LABELS, SAFE_TOOLS } from "../constants";

/** 文件操作工具 */
export const FILE_TOOLS = new Set(["Read", "Write", "Edit", "MultiEdit", "NotebookEdit"]);

/** 搜索类工具 */
export const SEARCH_TOOLS = new Set(["Grep", "Glob", "WebSearch", "WebFetch"]);

/** 任务类工具 */
export const TASK_TOOLS = new Set(["TaskCreate", "TaskUpdate", "TaskGet", "TaskList", "TodoWrite"]);

/** Agent 类工具 */
export const AGENT_TOOLS = new Set(["Agent", "Task", "Explore"]);

/** Bash 类工具 */
export const BASH_TOOLS = new Set(["Bash", "KillShell", "BashOutput"]);

// ---- 对齐 cc-gui toolConstants.ts 的工具名分类（小写）----

/** Read/file viewing tools */
export const READ_TOOL_NAMES = new Set(["read", "read_file", "read_multiple_files"]);

/** Edit/file modification tools */
export const EDIT_TOOL_NAMES = new Set(["edit", "edit_file", "replace_string", "write_to_file"]);

/** Bash/command execution tools */
export const BASH_TOOL_NAMES = new Set(["bash", "run_terminal_cmd", "exec_command", "execute_command", "shell_command"]);

/** Search/grep/glob tools */
export const SEARCH_TOOL_NAMES = new Set(["grep", "glob", "search", "find", "search_files"]);

/** Agent/subagent spawning tools */
export const AGENT_TOOL_NAMES = new Set(["task", "agent", "spawn_agent"]);

/** Task management tools (new structured Task API) */
export const TASK_MANAGE_TOOL_NAMES = new Set(["taskcreate", "taskupdate", "taskget", "tasklist"]);

/** Internal orchestration tools (transient) */
export const TRANSIENT_INTERNAL_TOOL_NAMES = new Set([
  "list_mcp_resources",
  "list_mcp_resource_templates",
  "read_mcp_resource",
  "parallel",
  "multi_tool_use.parallel",
]);

/** File modification tools (for rewind feature) */
export const FILE_MODIFY_TOOL_NAMES = new Set([
  "write", "write_file", "edit", "edit_file", "replace_string",
  "write_to_file", "notebookedit", "create_file",
]);

/**
 * Normalize a tool name: lowercase, and strip `mcp__server__` prefix if present.
 */
export function normalizeToolName(toolName: string): string {
  const lower = toolName.toLowerCase();
  const mcpMatch = /^mcp__[^_]+__(.+)$/.exec(lower);
  return mcpMatch ? mcpMatch[1] : lower;
}

/**
 * Check if a tool name matches a set of tool names (case-insensitive).
 */
export function isToolName(toolName: string | undefined, toolSet: Set<string>): boolean {
  return toolName !== undefined && toolSet.has(normalizeToolName(toolName));
}

/**
 * Whether a tool name is a transient internal orchestration tool.
 */
export function isTransientInternalToolName(toolName: string | undefined): boolean {
  if (!toolName) return false;
  const lower = toolName.toLowerCase();
  return TRANSIENT_INTERNAL_TOOL_NAMES.has(lower) || TRANSIENT_INTERNAL_TOOL_NAMES.has(normalizeToolName(lower));
}
