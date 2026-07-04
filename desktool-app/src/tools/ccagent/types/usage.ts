// usage.ts — 使用统计类型

export interface UsageStats {
  totalCost: number;
  totalInput: number;
  totalOutput: number;
  sessions: SessionUsageRecord[];
}

export interface SessionUsageRecord {
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  messageCount: number;
  summary: string;
  ts: number;
}

export interface ModelUsageStats {
  model: string;
  cost: number;
  input: number;
  output: number;
  count: number;
}

export interface TimelineUsageStats {
  day: string;
  cost: number;
  count: number;
}
