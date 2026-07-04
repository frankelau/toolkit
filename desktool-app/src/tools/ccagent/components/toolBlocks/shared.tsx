// 工具块共享类型和工具函数 — Phase 3

import type { ToolUseBlock } from "../../types";

export interface ToolBlockProps {
  tool: ToolUseBlock;
}

/** 工具状态图标 */
export function ToolStatusIcon({ tool }: { tool: ToolUseBlock }) {
  if (tool.isPending) return <span className="cc-tool-icon cc-tool-pending">⏳</span>;
  if (tool.isError) return <span className="cc-tool-icon cc-tool-error">❌</span>;
  return <span className="cc-tool-icon cc-tool-ok">✓</span>;
}

/** 从 input 取字符串字段 */
export function getInputString(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  return typeof v === "string" ? v : "";
}

/** 从 input 取数字字段 */
export function getInputNumber(input: Record<string, unknown>, key: string): number | undefined {
  const v = input[key];
  return typeof v === "number" ? v : undefined;
}

/** 从 input 取数组字段 */
export function getInputArray<T = unknown>(input: Record<string, unknown>, key: string): T[] {
  const v = input[key];
  return Array.isArray(v) ? v as T[] : [];
}

/** 从 result 提取输出文本 */
export function getResultText(result?: string): string {
  return result ?? "";
}

/** 截断长文本 */
export function truncate(text: string, max: number = 2000): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\n... (截断)";
}

/** 获取文件名（从路径） */
export function getFileName(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || filePath;
}

/** 工具名 → 图标映射 */
export const TOOL_ICONS: Record<string, string> = {
  Bash: "⚡",
  Read: "📖",
  Write: "✏️",
  Edit: "📝",
  MultiEdit: "📝",
  WebFetch: "🌐",
  WebSearch: "🔍",
  Grep: "🔎",
  Glob: "📁",
  Task: "📋",
  TaskCreate: "📋",
  TaskUpdate: "📋",
  TaskGet: "📋",
  TaskList: "📋",
  LSP: "🔧",
  Skill: "🎭",
  Agent: "🤖",
  NotebookEdit: "📓",
  TodoWrite: "☑️",
};
