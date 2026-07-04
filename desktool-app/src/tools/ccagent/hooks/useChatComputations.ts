// useChatComputations — 聊天派生计算（useMemo 聚合）
// 对齐 cc-gui useChatComputations

import { useMemo } from "react";
import type { ChatMessage } from "../types";
import {
  countUserMessages, countAssistantMessages, countToolUses, countToolErrors,
  sumUsage, getLastUserMessage, getLastAssistantMessage,
} from "../utils";

export interface ChatComputations {
  userMessageCount: number;
  assistantMessageCount: number;
  totalToolUses: number;
  toolErrors: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreateTokens: number;
  totalCostUsd: number;
  lastUserMessage: ChatMessage | undefined;
  lastAssistantMessage: ChatMessage | undefined;
  hasMessages: boolean;
  isStreaming: boolean;
}

export function useChatComputations(messages: ChatMessage[]): ChatComputations {
  return useMemo(() => {
    const usage = sumUsage(messages);
    return {
      userMessageCount: countUserMessages(messages),
      assistantMessageCount: countAssistantMessages(messages),
      totalToolUses: countToolUses(messages),
      toolErrors: countToolErrors(messages),
      totalInputTokens: usage.inputTokens,
      totalOutputTokens: usage.outputTokens,
      totalCacheReadTokens: usage.cacheReadTokens,
      totalCacheCreateTokens: usage.cacheCreateTokens,
      totalCostUsd: usage.costUsd,
      lastUserMessage: getLastUserMessage(messages),
      lastAssistantMessage: getLastAssistantMessage(messages),
      hasMessages: messages.length > 0,
      isStreaming: messages.some(m => m.isStreaming),
    };
  }, [messages]);
}
