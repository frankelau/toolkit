/**
 * messageSync.ts
 *
 * Pure utility functions for message identity preservation, optimistic message
 * handling, and streaming content repair. These functions have no React state
 * dependencies and receive everything they need via parameters.
 *
 * 对齐 cc-gui hooks/windowCallbacks/messageSync.ts
 * 适配：ClaudeMessage → ccagent ChatMessage；raw 字段 → 可选 Record<string, unknown>
 */

import type { ChatMessage } from "../../types";

/** Time window (ms) for matching optimistic messages with backend messages. */
export const OPTIMISTIC_MESSAGE_TIME_WINDOW = 5000;

export const getStreamEndHandlingMode = (
  provider: string,
  isStreaming: boolean,
  currentTurnId: number,
): "full" | "minimal" | "skip" => {
  if (isStreaming || currentTurnId > 0) {
    return "full";
  }
  if (provider === "codex") {
    return "minimal";
  }
  return "skip";
};

// ---------------------------------------------------------------------------
// Raw-field helpers
// ---------------------------------------------------------------------------

export const getRawUuid = (msg: ChatMessage | undefined): string | undefined => {
  const raw = (msg as unknown as { raw?: unknown })?.raw;
  if (!raw || typeof raw !== "object") return undefined;
  const rawObj = raw as Record<string, unknown>;
  return typeof rawObj.uuid === "string" ? rawObj.uuid : undefined;
};

export const stripUuidFromRaw = (raw: unknown): unknown => {
  if (!raw || typeof raw !== "object") return raw;
  const rawObj = raw as Record<string, unknown>;
  if (!("uuid" in rawObj)) return raw;
  const { uuid: _uuid, ...rest } = rawObj;
  return rest;
};

// ---------------------------------------------------------------------------
// Identity preservation
// ---------------------------------------------------------------------------

/**
 * Merge identity fields (timestamp, uuid) from prevMsg into nextMsg so that
 * React referential equality checks remain stable across backend re-sends.
 */
export const preserveMessageIdentity = (
  prevMsg: ChatMessage | undefined,
  nextMsg: ChatMessage,
): ChatMessage => {
  if (!prevMsg?.timestamp) return nextMsg;
  if (prevMsg.role !== nextMsg.role) return nextMsg;

  const prevUuid = getRawUuid(prevMsg as unknown as ChatMessage);
  const nextUuid = getRawUuid(nextMsg as unknown as ChatMessage);

  const nextWithStableTimestamp =
    nextMsg.timestamp === prevMsg.timestamp
      ? nextMsg
      : { ...nextMsg, timestamp: prevMsg.timestamp };

  if (!prevUuid && nextUuid) {
    return {
      ...nextWithStableTimestamp,
    };
  }

  return nextWithStableTimestamp;
};

/**
 * Extract comparable text content from a user message for deduplication matching.
 */
const getUserMessageComparableContent = (msg: ChatMessage): string => {
  if (typeof msg.content === "string") return msg.content;
  return "";
};

/**
 * Get message timestamp in milliseconds.
 */
export const getMessageTimestampMs = (message: ChatMessage): number | undefined => {
  if (typeof message.timestamp === "number") return message.timestamp;
  return undefined;
};

/**
 * If the previous list ended with an optimistic user message that has not yet
 * been matched by a backend message, keep it appended to nextList.
 */
export const appendOptimisticMessageIfMissing = (
  prevList: ChatMessage[],
  nextList: ChatMessage[],
): ChatMessage[] => {
  const lastPrev = prevList[prevList.length - 1];
  if (!(lastPrev as unknown as { isOptimistic?: boolean })?.isOptimistic) return nextList;

  const optimisticMsg = lastPrev;
  const optimisticText = getUserMessageComparableContent(optimisticMsg);
  const optimisticTime = getMessageTimestampMs(optimisticMsg) ?? Number.NaN;

  const matchFn = (m: ChatMessage) => {
    if (m.role !== "user") return false;
    if (getUserMessageComparableContent(m) !== optimisticText) return false;
    const candidateTime = getMessageTimestampMs(m) ?? Number.NaN;
    if (!Number.isFinite(candidateTime) || !Number.isFinite(optimisticTime)) return false;
    return Math.abs(candidateTime - optimisticTime) < OPTIMISTIC_MESSAGE_TIME_WINDOW;
  };

  const matchedIndex = nextList.findIndex(matchFn);
  if (matchedIndex < 0) {
    // Guard against stale backend updates
    if (nextList.length > 0 && Number.isFinite(optimisticTime)) {
      let maxNextTime = 0;
      for (const m of nextList) {
        const ts = getMessageTimestampMs(m) ?? 0;
        if (Number.isFinite(ts) && ts > maxNextTime) {
          maxNextTime = ts;
        }
      }
      if (maxNextTime > 0 && optimisticTime > maxNextTime) {
        return nextList;
      }
    }
    return [...nextList, optimisticMsg];
  }

  return nextList;
};

/**
 * Preserve the identity (timestamp) of the last assistant message when the
 * backend re-sends the full message list.
 */
export const preserveLastAssistantIdentity = (
  prevList: ChatMessage[],
  nextList: ChatMessage[],
): ChatMessage[] => {
  const lastPrevAssistant = [...prevList].reverse().find((m) => m.role === "assistant");
  if (!lastPrevAssistant) return nextList;

  const lastNextAssistantIndex = [...nextList].reverse().findIndex((m) => m.role === "assistant");
  if (lastNextAssistantIndex < 0) return nextList;

  const realIndex = nextList.length - 1 - lastNextAssistantIndex;
  const preserved = preserveMessageIdentity(lastPrevAssistant, nextList[realIndex]);
  const result = [...nextList];
  result[realIndex] = preserved;
  return result;
};

/**
 * Merge raw content blocks during streaming to avoid flicker.
 */
export const mergeRawBlocksDuringStreaming = (
  prevMsg: ChatMessage | undefined,
  nextMsg: ChatMessage,
): ChatMessage => {
  if (!prevMsg || prevMsg.role !== nextMsg.role) return nextMsg;
  return { ...nextMsg, timestamp: prevMsg.timestamp };
};

/**
 * Preserve streaming assistant content when a new message list arrives.
 */
export const preserveStreamingAssistantContent = (
  prevList: ChatMessage[],
  nextList: ChatMessage[],
  streamingIndex: number,
): ChatMessage[] => {
  if (streamingIndex < 0 || streamingIndex >= prevList.length) return nextList;
  const streamingMsg = prevList[streamingIndex];
  if (!streamingMsg || streamingMsg.role !== "assistant") return nextList;

  if (nextList.length === 0) return [streamingMsg];

  const lastNext = nextList[nextList.length - 1];
  if (lastNext.role === "assistant" && lastNext.isStreaming) {
    const result = [...nextList];
    result[result.length - 1] = preserveMessageIdentity(streamingMsg, lastNext);
    return result;
  }

  return [...nextList, streamingMsg];
};

/**
 * Strip duplicate trailing tool messages that can appear when the backend
 * re-sends the full message list during streaming.
 */
export const stripDuplicateTrailingToolMessages = (
  messages: ChatMessage[],
): ChatMessage[] => {
  if (messages.length < 2) return messages;
  const result = [...messages];
  while (result.length >= 2) {
    const last = result[result.length - 1];
    const prev = result[result.length - 2];
    if (
      last.role === "user" &&
      prev.role === "user" &&
      getUserMessageComparableContent(last) === getUserMessageComparableContent(prev)
    ) {
      result.pop();
    } else {
      break;
    }
  }
  return result;
};

/**
 * Preserve the latest messages when the message list shrinks (e.g. due to
 * a backend re-send that hasn't caught up yet).
 */
export const preserveLatestMessagesOnShrink = (
  prevList: ChatMessage[],
  nextList: ChatMessage[],
): ChatMessage[] => {
  if (nextList.length >= prevList.length) return nextList;
  // If the new list is significantly shorter, keep the previous list to avoid flicker
  if (nextList.length < prevList.length * 0.5) return prevList;
  return nextList;
};

/**
 * Ensure the streaming assistant message exists in the list at the expected index.
 */
export const ensureStreamingAssistantInList = (
  messages: ChatMessage[],
  streamingContent: string,
  streamingIndex: number,
): ChatMessage[] => {
  if (streamingIndex < 0) return messages;
  if (streamingIndex < messages.length && messages[streamingIndex].role === "assistant") {
    return messages;
  }
  const streamingMsg: ChatMessage = {
    id: `streaming-${streamingIndex}`,
    role: "assistant",
    content: streamingContent,
    isStreaming: true,
    timestamp: Date.now(),
  };
  const result = [...messages];
  result.splice(streamingIndex, 0, streamingMsg);
  return result;
};
