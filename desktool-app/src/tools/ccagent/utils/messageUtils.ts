// messageUtils.ts — 消息工具函数

import type { ChatMessage, ToolUseBlock } from "../types";
import { summarizeToolInput } from "./toolUtils";

/** 从消息列表中提取所有工具调用 */
export function extractToolUses(messages: ChatMessage[]): Array<{ msg: ChatMessage; tool: ToolUseBlock }> {
  const result: Array<{ msg: ChatMessage; tool: ToolUseBlock }> = [];
  for (const msg of messages) {
    if (msg.toolUses) {
      for (const tool of msg.toolUses) {
        result.push({ msg, tool });
      }
    }
  }
  return result;
}

/** 统计用户消息数 */
export function countUserMessages(messages: ChatMessage[]): number {
  return messages.filter(m => m.role === "user").length;
}

/** 统计 assistant 消息数 */
export function countAssistantMessages(messages: ChatMessage[]): number {
  return messages.filter(m => m.role === "assistant").length;
}

/** 统计工具调用数 */
export function countToolUses(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => sum + (m.toolUses?.length ?? 0), 0);
}

/** 统计错误工具调用数 */
export function countToolErrors(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) =>
    sum + (m.toolUses?.filter(t => t.isError).length ?? 0), 0);
}

/** 获取最后一条用户消息 */
export function getLastUserMessage(messages: ChatMessage[]): ChatMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i];
  }
  return undefined;
}

/** 获取最后一条 assistant 消息 */
export function getLastAssistantMessage(messages: ChatMessage[]): ChatMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") return messages[i];
  }
  return undefined;
}

/** 累计 token 使用量 */
export function sumUsage(messages: ChatMessage[]): {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
  costUsd: number;
} {
  return messages.reduce((acc, m) => {
    if (m.usage) {
      acc.inputTokens += m.usage.inputTokens ?? 0;
      acc.outputTokens += m.usage.outputTokens ?? 0;
      acc.cacheReadTokens += m.usage.cacheReadTokens ?? 0;
      acc.cacheCreateTokens += m.usage.cacheCreateTokens ?? 0;
      acc.costUsd += m.usage.costUsd ?? 0;
    }
    return acc;
  }, { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreateTokens: 0, costUsd: 0 });
}

/** 搜索消息（支持 content 和 thinking） */
export function searchMessages(messages: ChatMessage[], query: string): ChatMessage[] {
  if (!query.trim()) return messages;
  const q = query.toLowerCase();
  return messages.filter(m =>
    m.content.toLowerCase().includes(q) ||
    (m.thinking?.toLowerCase().includes(q) ?? false)
  );
}

/** 生成消息摘要（用于历史列表） */
export function summarizeMessage(msg: ChatMessage, maxLen = 60): string {
  const base = msg.content || msg.thinking || "";
  if (msg.toolUses?.length) {
    const tools = msg.toolUses.map(t => summarizeToolInput(t.name, t.input)).filter(Boolean).join(", ");
    return tools.slice(0, maxLen) || base.slice(0, maxLen);
  }
  return base.slice(0, maxLen);
}

/**
 * 生成消息的稳定 key，用于 React 列表 key 和锚点导航。
 * 优先使用 msg.id > role-timestamp > role-index 兜底。
 */
export function getMessageKey(message: ChatMessage, index: number): string {
  if (message.id) return message.id;
  return message.timestamp ? `${message.role}-${message.timestamp}` : `${message.role}-${index}`;
}

/** 按工具类型分组统计 */
export interface ToolTypeStats {
  name: string;
  count: number;
  errors: number;
}
export function countToolsByType(messages: ChatMessage[]): ToolTypeStats[] {
  const map = new Map<string, { count: number; errors: number }>();
  for (const m of messages) {
    if (!m.toolUses) continue;
    for (const t of m.toolUses) {
      const entry = map.get(t.name) || { count: 0, errors: 0 };
      entry.count++;
      if (t.isError) entry.errors++;
      map.set(t.name, entry);
    }
  }
  return Array.from(map.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.count - a.count);
}

/** 按轮次统计（用户消息为轮次边界） */
export interface TurnStats {
  turn: number;
  userInput: string;
  toolCount: number;
  durationMs: number;
  tokens: { input: number; output: number; cache: number };
}
export function computeTurnStats(messages: ChatMessage[]): TurnStats[] {
  const turns: TurnStats[] = [];
  let current: Partial<TurnStats> = { tokens: { input: 0, output: 0, cache: 0 } };

  for (const m of messages) {
    if (m.role === "user") {
      if (current.userInput) turns.push(current as TurnStats);
      current = {
        turn: turns.length + 1,
        userInput: m.content?.slice(0, 100) || "",
        toolCount: 0,
        durationMs: 0,
        tokens: { input: 0, output: 0, cache: 0 },
      };
    } else if (m.role === "assistant") {
      current.toolCount = (current.toolCount || 0) + (m.toolUses?.length || 0);
      if (m.usage) {
        current.tokens!.input += m.usage.inputTokens || 0;
        current.tokens!.output += m.usage.outputTokens || 0;
        current.tokens!.cache += (m.usage.cacheReadTokens || 0) + (m.usage.cacheCreateTokens || 0);
        current.durationMs = (current.durationMs || 0) + (m.usage.durationMs || 0);
      }
    }
  }
  if (current.userInput) turns.push(current as TurnStats);
  return turns;
}

/** 消息去重合并（流式结束时替换占位消息） */
export function mergeStreamingMessage(
  messages: ChatMessage[],
  finalMessage: ChatMessage,
): ChatMessage[] {
  const result = [...messages];
  // 找到最后一个 streaming 消息并替换
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].isStreaming) {
      result[i] = { ...finalMessage, isStreaming: false };
      return result;
    }
  }
  // 没找到 streaming 消息，追加
  result.push({ ...finalMessage, isStreaming: false });
  return result;
}

/** 获取会话统计摘要 */
export interface SessionSummary {
  messageCount: number;
  userCount: number;
  assistantCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  cacheHitTokens: number;
  totalCost: number;
  totalDurationMs: number;
  toolCount: number;
  toolErrorCount: number;
  firstTimestamp?: number;
  lastTimestamp?: number;
}

export function computeSessionSummary(messages: ChatMessage[]): SessionSummary {
  const summary: SessionSummary = {
    messageCount: messages.length,
    userCount: 0, assistantCount: 0,
    totalInputTokens: 0, totalOutputTokens: 0,
    cacheHitTokens: 0, totalCost: 0, totalDurationMs: 0,
    toolCount: 0, toolErrorCount: 0,
  };

  let firstTs: number | undefined, lastTs: number | undefined;
  for (const m of messages) {
    if (m.role === "user") summary.userCount++;
    else if (m.role === "assistant") summary.assistantCount++;

    if (m.usage) {
      summary.totalInputTokens += m.usage.inputTokens ?? 0;
      summary.totalOutputTokens += m.usage.outputTokens ?? 0;
      summary.cacheHitTokens += (m.usage.cacheReadTokens ?? 0) + (m.usage.cacheCreateTokens ?? 0);
      summary.totalCost += m.usage.costUsd ?? 0;
      summary.totalDurationMs += m.usage.durationMs ?? 0;
    }

    if (m.toolUses) {
      summary.toolCount += m.toolUses.length;
      summary.toolErrorCount += m.toolUses.filter(t => t.isError).length;
    }

    if (m.timestamp) {
      if (!firstTs || m.timestamp < firstTs) firstTs = m.timestamp;
      if (!lastTs || m.timestamp > lastTs) lastTs = m.timestamp;
    }
  }

  summary.firstTimestamp = firstTs;
  summary.lastTimestamp = lastTs;
  return summary;
}
