// utils.ts — StatusPanel 工具函数
// 对齐 cc-gui StatusPanel/utils.ts

import type { TodoItem, SubagentInfo, FileChangeSummary } from "../../types";

/** Todo 统计 */
export function computeTodoStats(todos: TodoItem[]) {
  const completed = todos.filter(t => t.status === "completed").length;
  const inProgress = todos.filter(t => t.status === "in_progress").length;
  const pending = todos.filter(t => t.status === "pending").length;
  const pct = todos.length > 0 ? Math.round((completed / todos.length) * 100) : 0;
  return { completed, inProgress, pending, pct };
}

/** Subagent 统计 */
export function computeSubagentStats(subagents: SubagentInfo[]) {
  const completed = subagents.filter(s => s.status === "completed").length;
  const running = subagents.some(s => s.status === "running");
  return { completed, running, total: subagents.length };
}

/** 文件变更统计 */
export function computeFileStats(fileChanges: FileChangeSummary[]) {
  const totalAdds = fileChanges.reduce((s, f) => s + f.additions, 0);
  const totalDels = fileChanges.reduce((s, f) => s + f.deletions, 0);
  return { totalAdds, totalDels, fileCount: fileChanges.length };
}

/** 上下文用量百分比 */
export function computeUsagePct(used: number, max: number): number {
  return max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
}

/** Todo 排序：in_progress > pending > completed */
export function sortTodos(todos: TodoItem[]): TodoItem[] {
  const order: Record<string, number> = { in_progress: 0, pending: 1, completed: 2 };
  return [...todos].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
}

/** Todo 状态图标 */
export const TODO_STATUS_ICON: Record<string, string> = {
  pending: "○", in_progress: "◎", completed: "●",
};

/** Todo 状态 className */
export const TODO_STATUS_CLASS: Record<string, string> = {
  pending: "", in_progress: "cc-todo-progress", completed: "cc-todo-done",
};

/** Subagent 状态图标 */
export const SUBAGENT_STATUS_ICON: Record<string, string> = {
  running: "↺", completed: "✓", error: "✗",
};

/** Subagent 状态 className */
export const SUBAGENT_STATUS_CLASS: Record<string, string> = {
  running: "cc-agent-running", completed: "cc-agent-done", error: "cc-agent-error",
};
