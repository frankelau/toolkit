// core.ts — 核心类型：Engine, ChatMessage, ToolUseBlock

export type Engine = "claude" | "codex";

export interface EngineInfo {
  path: string;
  version: string;
}

export interface Attachment {
  type: "image";
  data: string;
  mimeType: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  toolUses?: ToolUseBlock[];
  isStreaming?: boolean;
  usage?: MessageUsage;
  timestamp: number;
  attachments?: Attachment[];
}

export interface ToolUseBlock {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isPending?: boolean;
  isError?: boolean;
  diff?: DiffResult;
}

export interface MessageUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreateTokens?: number;
  costUsd?: number;
  durationMs?: number;
}

export interface DiffResult {
  filePath: string;
  oldContent: string | null;
  newContent: string;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  type: "add" | "del" | "ctx";
  text: string;
  oldLine?: number;
  newLine?: number;
}

// ─── B12: 多目录工作区 Tab ─────────────────────────────────────────────────

export interface WorkspaceTab {
  id: string;
  cwd: string;
  name: string;
  sessionId: string | null;
  engine: Engine;
  messages: ChatMessage[];
  streaming: boolean;
}
