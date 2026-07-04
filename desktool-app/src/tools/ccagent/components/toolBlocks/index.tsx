// 工具块分发器 — 根据工具名选择专用工具块

import type { ToolUseBlock } from "../../types";
import { BashToolBlock } from "./BashToolBlock";
import { ReadToolBlock } from "./ReadToolBlock";
import { EditToolBlock } from "./EditToolBlock";
import { SearchToolBlock } from "./SearchToolBlock";
import { TaskToolBlock } from "./TaskToolBlock";
import { AgentToolBlock } from "./AgentToolBlock";
import { TaskExecutionBlock } from "./TaskExecutionBlock";
import { GenericToolBlock } from "./GenericToolBlock";

const BASH_TOOLS = new Set(["Bash", "KillShell", "BashOutput"]);
const READ_TOOLS = new Set(["Read", "NotebookRead"]);
const EDIT_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
const SEARCH_TOOLS = new Set(["Grep", "Glob", "WebSearch", "WebFetch"]);
const TASK_TOOLS = new Set(["TaskCreate", "TaskUpdate", "TaskGet", "TaskList", "TaskStop", "TaskOutput", "TodoWrite"]);
const AGENT_TOOLS = new Set(["Agent", "Explore"]);
const TASK_EXEC_TOOLS = new Set(["Task"]);

export function ToolBlockDispatcher({ tool }: { tool: ToolUseBlock }) {
  const name = tool.name;

  // 优先用 TaskExecutionBlock 展示 spawn_agent 任务
  if (TASK_EXEC_TOOLS.has(name) && tool.result) {
    return <TaskExecutionBlock name={name} input={tool.input} result={tool.result} toolId={tool.id} />;
  }
  if (BASH_TOOLS.has(name)) return <BashToolBlock tool={tool} />;
  if (READ_TOOLS.has(name)) return <ReadToolBlock tool={tool} />;
  if (EDIT_TOOLS.has(name)) return <EditToolBlock tool={tool} />;
  if (SEARCH_TOOLS.has(name)) return <SearchToolBlock tool={tool} />;
  if (TASK_TOOLS.has(name)) return <TaskToolBlock tool={tool} />;
  if (AGENT_TOOLS.has(name)) return <AgentToolBlock tool={tool} />;

  // Fallback: "Task" without result → AgentToolBlock
  if (name === "Task") return <AgentToolBlock tool={tool} />;

  return <GenericToolBlock tool={tool} />;
}

export { BashToolBlock, ReadToolBlock, EditToolBlock, SearchToolBlock, TaskToolBlock, AgentToolBlock, GenericToolBlock, TaskExecutionBlock };
