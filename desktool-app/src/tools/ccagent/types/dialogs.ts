// dialogs.ts — 对话框相关类型

export interface PlanApprovalRequest {
  requestId: string;
  toolName: string;
  plan?: string;
  allowedPrompts?: { tool: string; prompt: string }[];
  timestamp?: string;
}

export interface QuestionOption { label: string; description: string; }
export interface Question {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect: boolean;
}

export interface AskUserQuestionRequest {
  requestId: string;
  toolName: string;
  questions: Question[];
}

export interface RewindRequest {
  sessionId: string;
  messageId: string;
  messageContent: string;
  messageTimestamp?: number;
  messagesAfterCount: number;
}

export interface RewindableMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ContextCategory {
  name: string;
  tokens: number;
  color: string;
  items?: { name: string; tokens: number; type?: string }[];
}

export interface ContextUsageData {
  totalTokens: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  sessionId?: string;
  model?: string;
  autoCompactThreshold?: number;
  contextWindow?: number;
  categories?: ContextCategory[];
  memoryFiles?: { path: string; tokens: number }[];
  mcpTools?: { name: string; tokens: number }[];
  agents?: { id: string; type: string; tokens: number }[];
  skills?: { name: string; tokens: number }[];
}
