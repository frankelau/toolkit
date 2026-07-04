// subagent.ts — 子 Agent 相关类型

export type SubagentStatus = 'running' | 'completed' | 'error';

export interface SubagentInfo {
  id: string;
  type: string;
  description: string;
  prompt?: string;
  status: SubagentStatus;
  totalDurationMs?: number;
  totalTokens?: number;
  totalToolUseCount?: number;
  resultText?: string;
}

export interface TodoItem {
  id?: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  blockedBy?: string[];
}

export type StatusPanelTab = 'todo' | 'subagent' | 'files';
