import type { ChatMessage, ToolUseBlock } from "../types";
import { normalizeToolName, TASK_MANAGE_TOOL_NAMES } from "./toolConstants";
import { normalizeTodoStatus } from "./todoShared";
import type { RawTodoItem } from "./todoShared";
import type { TodoItem } from "../types";

function getTodoContent(item: RawTodoItem): string | null {
  const candidates = [item.content, item.step, item.title, item.text, item.subject, item.description];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function normalizeTodoItem(item: RawTodoItem): TodoItem | null {
  const content = getTodoContent(item);
  if (!content) {
    return null;
  }

  const normalized: TodoItem = {
    content,
    status: normalizeTodoStatus(item.status),
  };

  if (typeof item.id === "string" || typeof item.id === "number") {
    normalized.id = String(item.id);
  }

  // Preserve blockedBy if present in the raw item
  if (Array.isArray(item.blockedBy)) {
    normalized.blockedBy = item.blockedBy
      .map((id: unknown) => (typeof id === "string" || typeof id === "number" ? String(id) : null))
      .filter((id): id is string => id !== null);
  }

  return normalized;
}

/**
 * Extract todos from a tool_use block (TodoWrite or update_plan tools).
 */
export function extractTodosFromToolUse(block: ToolUseBlock): TodoItem[] | null {
  const toolName = normalizeToolName(block.name ?? "");
  const input = (block.input ?? {}) as Record<string, unknown>;

  if (toolName === "todowrite") {
    if (!Array.isArray(input.todos)) {
      return null;
    }
    return input.todos
      .map((item) => (item && typeof item === "object" ? normalizeTodoItem(item as RawTodoItem) : null))
      .filter((item): item is TodoItem => item !== null);
  }

  if (toolName === "update_plan") {
    if (!Array.isArray(input.plan)) {
      return null;
    }
    return input.plan
      .map((item) => (item && typeof item === "object" ? normalizeTodoItem(item as RawTodoItem) : null))
      .filter((item): item is TodoItem => item !== null);
  }

  return null;
}

export function isTaskManageTool(block: ToolUseBlock): boolean {
  return TASK_MANAGE_TOOL_NAMES.has(normalizeToolName(block.name ?? ""));
}

/**
 * Extract accumulated tasks from TaskCreate/TaskUpdate tool calls (new structured Task API).
 *
 * Task ID resolution: TaskCreate input does not contain the real task ID — it is only
 * available in the tool_result user message (toolUseResult.task.id). This function makes
 * a single pass over the messages: user messages build a tool_use_id → real taskId map,
 * assistant messages buffer their TaskCreate/TaskUpdate blocks. The buffered blocks are
 * then processed in document order once the full id map is known. Sessions without any
 * task tools short-circuit before allocating the task map.
 *
 * Adapted for ccagent's ChatMessage (toolUses array on assistant messages; user tool
 * results are encoded as assistant-like messages with isPending=false and a result string).
 */
export function extractAccumulatedTasks(messages: ChatMessage[]): TodoItem[] {
  const toolUseToTaskId = new Map<string, string>();
  const pendingTaskBlocks: ToolUseBlock[] = [];

  for (const msg of messages) {
    if (msg.role === "assistant") {
      const blocks = msg.toolUses ?? [];
      for (const block of blocks) {
        const toolName = normalizeToolName(block.name ?? "");
        if (toolName === "taskcreate" || toolName === "taskupdate") {
          pendingTaskBlocks.push(block);
        }
        // Resolve task id from tool result content (e.g. "Task #1 created successfully")
        if (typeof block.result === "string" && block.result) {
          const match = /\btask\s*#(\d+)/i.exec(block.result);
          if (match && block.id) {
            toolUseToTaskId.set(block.id, match[1]);
          }
        }
      }
    }
  }

  if (pendingTaskBlocks.length === 0) return [];

  // Process buffered TaskCreate / TaskUpdate in document order using the resolved IDs.
  const taskMap = new Map<string, TodoItem>();
  for (const block of pendingTaskBlocks) {
    const toolName = normalizeToolName(block.name ?? "");
    const input = (block.input ?? {}) as Record<string, unknown>;

    if (toolName === "taskcreate") {
      const subject = input.subject;
      const description = input.description;
      const realTaskId = block.id ? toolUseToTaskId.get(block.id) : undefined;
      const taskId = realTaskId ?? block.id;

      if (typeof subject === "string" && subject.trim() && taskId) {
        const content = description && typeof description === "string"
          ? `${subject}: ${description}`.trim()
          : subject.trim();

        taskMap.set(String(taskId), {
          id: String(taskId),
          content,
          status: "pending",
        });
      }
    } else if (toolName === "taskupdate") {
      const taskId = typeof input.taskId === "string" ? input.taskId : String(input.taskId ?? "");
      if (!taskId || !taskMap.has(taskId)) continue;
      const existing = taskMap.get(taskId)!;

      if (input.status === "deleted") {
        taskMap.delete(taskId);
        continue;
      }
      if (typeof input.status === "string") {
        existing.status = normalizeTodoStatus(input.status);
      }
      if (typeof input.subject === "string" && input.subject.trim()) {
        existing.content = input.subject.trim();
      }

      // addBlocks: this task becomes the blocker for the listed task IDs
      if (Array.isArray(input.addBlocks)) {
        for (const id of input.addBlocks) {
          const blockedId = String(id);
          const blocked = taskMap.get(blockedId);
          if (blocked) {
            if (!blocked.blockedBy) blocked.blockedBy = [];
            if (!blocked.blockedBy.includes(taskId)) {
              blocked.blockedBy.push(taskId);
            }
          }
        }
      }

      // addBlockedBy: this task is blocked by the listed task IDs
      if (Array.isArray(input.addBlockedBy)) {
        if (!existing.blockedBy) existing.blockedBy = [];
        for (const id of input.addBlockedBy) {
          const blockerId = String(id);
          if (!existing.blockedBy.includes(blockerId)) {
            existing.blockedBy.push(blockerId);
          }
        }
      }
    }
  }

  return Array.from(taskMap.values());
}
