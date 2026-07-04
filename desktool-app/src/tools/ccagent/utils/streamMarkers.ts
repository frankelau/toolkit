// streamMarkers.ts — 流式标记常量

/** 流式事件类型 */
export const STREAM_EVENT_TYPES = {
  SYSTEM: "system",
  ASSISTANT: "assistant",
  USER: "user",
  RESULT: "result",
  STREAM: "stream",
  STREAM_END: "stream_end",
  ERROR: "error",
  STDERR: "stderr",
  PERMISSION_REQUEST: "permission_request",
  PLAN_APPROVAL: "plan_approval",
  ASK_USER_QUESTION: "ask_user_question",
  CONTEXT_USAGE: "context_usage",
  DAEMON: "daemon",
} as const;

/** Content block 类型 */
export const CONTENT_BLOCK_TYPES = {
  TEXT: "text",
  THINKING: "thinking",
  TOOL_USE: "tool_use",
  TOOL_RESULT: "tool_result",
  IMAGE: "image",
} as const;

/** 工具结果状态 */
export const TOOL_RESULT_STATUS = {
  PENDING: "pending",
  SUCCESS: "success",
  ERROR: "error",
} as const;
