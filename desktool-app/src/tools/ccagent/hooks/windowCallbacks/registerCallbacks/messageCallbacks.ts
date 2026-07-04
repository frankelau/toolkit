/**
 * registerCallbacks/messageCallbacks.ts
 *
 * Registers Tauri event listeners for message updates, status changes, and
 * history data.
 *
 * 对齐 cc-gui hooks/windowCallbacks/registerCallbacks/messageCallbacks.ts
 * 适配：window.updateMessages = (json, sequence) => {} → listen("cc-update-messages", (event) => {})
 *       window.__pending* 防抖机制 → 简化为直接处理（Tauri 事件天然有序）
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { WindowCallbacksOptions } from "../types";
import type { ChatMessage } from "../../../types";
import {
  appendOptimisticMessageIfMissing,
  preserveLastAssistantIdentity,
  stripDuplicateTrailingToolMessages,
} from "../messageSync";

const isTruthy = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "1";
  if (typeof value === "number") return value !== 0;
  return Boolean(value);
};

export async function registerMessageCallbacks(
  options: WindowCallbacksOptions,
  _resetTransientUiState: () => void,
): Promise<UnlistenFn[]> {
  const {
    setMessages,
    setStatus,
    setLoading,
    setIsThinking,
    setSummary,
    setHistoryData,
  } = options;

  const unlisteners: UnlistenFn[] = [];

  // Update messages
  unlisteners.push(
    await listen<string>("cc-update-messages", (event) => {
      try {
        const payload = typeof event.payload === "string"
          ? JSON.parse(event.payload)
          : event.payload;
        const json = payload.json ?? payload;

        // Skip if session transitioning
        const w = window as unknown as Record<string, unknown>;
        if (w.__sessionTransitioning) return;

        const parsed = typeof json === "string" ? JSON.parse(json) : json;
        let messages: ChatMessage[] = Array.isArray(parsed) ? parsed : (parsed?.messages ?? []);

        // Apply message sync utilities
        messages = stripDuplicateTrailingToolMessages(messages);

        setMessages((prev: ChatMessage[]) => {
          let next = appendOptimisticMessageIfMissing(prev, messages);
          next = preserveLastAssistantIdentity(prev, next);
          return next;
        });
      } catch (error) {
        console.error("[messageCallbacks] Failed to parse messages update:", error);
      }
    }),
  );

  // Update status
  unlisteners.push(
    await listen<string>("cc-update-status", (event) => {
      const text = typeof event.payload === "string" ? event.payload : "";
      setStatus(text);
    }),
  );

  // Show loading
  unlisteners.push(
    await listen<string>("cc-show-loading", (event) => {
      const value = typeof event.payload === "string" ? event.payload : "";
      setLoading(isTruthy(value));
    }),
  );

  // Show thinking status
  unlisteners.push(
    await listen<string>("cc-show-thinking-status", (event) => {
      const value = typeof event.payload === "string" ? event.payload : "";
      setIsThinking(isTruthy(value));
    }),
  );

  // Show summary
  unlisteners.push(
    await listen<string>("cc-show-summary", (event) => {
      try {
        const summary = typeof event.payload === "string"
          ? JSON.parse(event.payload)
          : event.payload;
        setSummary(summary);
      } catch (error) {
        console.error("[messageCallbacks] Failed to parse summary:", error);
      }
    }),
  );

  // Set history data
  unlisteners.push(
    await listen<string>("cc-set-history-data", (event) => {
      try {
        const data = typeof event.payload === "string"
          ? JSON.parse(event.payload)
          : event.payload;
        setHistoryData(data);
      } catch (error) {
        console.error("[messageCallbacks] Failed to parse history data:", error);
      }
    }),
  );

  // ── D6增强: 工具调用结果内联 (H5) ──────────────────────────────────────
  // cc-tool-result: 后端推送单个工具调用结果
  unlisteners.push(
    await listen<{ toolId: string; result: string; isError?: boolean }>(
      "cc-tool-result",
      (event) => {
        const { toolId, result, isError } = event.payload || {};
        if (!toolId) return;

        setMessages((prev: ChatMessage[]) => {
          if (prev.length === 0) return prev;

          // 从后往前找包含该 toolId 的 assistant 消息
          const result_ = [...prev];
          for (let i = result_.length - 1; i >= 0; i--) {
            const msg = result_[i];
            const tools = msg.toolUses;
            if (!tools) continue;
            const toolIdx = tools.findIndex(t => t.id === toolId);
            if (toolIdx === -1) continue;

            const updated = [...tools];
            updated[toolIdx] = {
              ...updated[toolIdx],
              result,
              isPending: false,
              isError: !!isError,
            };
            result_[i] = { ...msg, toolUses: updated };
            return result_;
          }
          return prev;
        });
      },
    ),
  );

  return unlisteners;
}
