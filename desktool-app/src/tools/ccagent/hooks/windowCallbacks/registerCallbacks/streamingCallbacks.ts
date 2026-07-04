/**
 * registerCallbacks/streamingCallbacks.ts
 *
 * Registers Tauri event listeners for streaming events:
 * onStreamStart, onContentDelta, onThinkingDelta, onStreamEnd,
 * onStreamingHeartbeat, onPermissionDenied, onBlockReset.
 *
 * 对齐 cc-gui hooks/windowCallbacks/registerCallbacks/streamingCallbacks.ts
 * 适配：window.onStreamStart = (mode) => {} → listen("cc-stream-start", (event) => {})
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { WindowCallbacksOptions } from "../types";
import type { ChatMessage } from "../../../types";
import { cleanStreamEnd } from "../contentBlockNormalize";

export async function registerStreamingCallbacks(
  options: WindowCallbacksOptions,
): Promise<UnlistenFn[]> {
  const {
    isStreamingRef,
    streamingContentRef,
    streamingThinkingRef,
    streamingMessageIndexRef,
    setStreamingActive,
    setIsThinking,
    setStatus,
    setMessages,
  } = options;

  const unlisteners: UnlistenFn[] = [];

  // Stream start
  unlisteners.push(
    await listen<string>("cc-stream-start", (event) => {
      const mode = typeof event.payload === "string" ? event.payload : "";
      isStreamingRef.current = true;
      setStreamingActive(true);
      if (mode === "thinking") {
        setIsThinking(true);
      }
      // Initialize streaming content buffer
      streamingContentRef.current = "";
      streamingThinkingRef.current = "";
      streamingMessageIndexRef.current = -1;
    }),
  );

  // Content delta
  unlisteners.push(
    await listen<string>("cc-content-delta", (event) => {
      const delta = typeof event.payload === "string" ? event.payload : "";
      if (!isStreamingRef.current) return;
      streamingContentRef.current += delta;
      // Update the streaming message content
      setMessages((prev: ChatMessage[]) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last?.isStreaming) {
          const result = [...prev];
          result[result.length - 1] = { ...result[result.length - 1], content: streamingContentRef.current };
          return result;
        }
        return prev;
      });
    }),
  );

  // Thinking delta
  unlisteners.push(
    await listen<string>("cc-thinking-delta", (event) => {
      const delta = typeof event.payload === "string" ? event.payload : "";
      if (!isStreamingRef.current) return;
      streamingThinkingRef.current += delta;
    }),
  );

  // Stream end
  unlisteners.push(
    await listen<string>("cc-stream-end", () => {
      isStreamingRef.current = false;
      setStreamingActive(false);
      setIsThinking(false);
      // Finalize streaming message with content cleanup
      setMessages((prev: ChatMessage[]) => {
        if (prev.length === 0) return prev;
        const result = [...prev];
        const last = result[result.length - 1];
        if (last?.isStreaming) {
          const { isStreaming: _isStreaming, ...rest } = last;
          void _isStreaming;
          // Clean streaming artifacts from the final content
          const cleaned = rest as ChatMessage;
          if (cleaned.content) {
            cleaned.content = cleanStreamEnd(cleaned.content);
          }
          result[result.length - 1] = cleaned;
        }
        return result;
      });
      // Reset streaming buffers
      streamingContentRef.current = "";
      streamingThinkingRef.current = "";
      streamingMessageIndexRef.current = -1;
    }),
  );

  // Streaming heartbeat
  unlisteners.push(
    await listen("cc-streaming-heartbeat", () => {
      // Update last activity timestamp (used for timeout detection)
      (window as unknown as Record<string, unknown>).__lastStreamActivityAt = Date.now();
    }),
  );

  // Permission denied
  unlisteners.push(
    await listen("cc-permission-denied", () => {
      isStreamingRef.current = false;
      setStreamingActive(false);
      setIsThinking(false);
      setStatus("Permission denied");
    }),
  );

  // Block reset
  unlisteners.push(
    await listen("cc-block-reset", () => {
      streamingContentRef.current = "";
      streamingThinkingRef.current = "";
    }),
  );

  // ── D6增强: 工具状态更新 (H4) ──────────────────────────────────────────
  // cc-tool-status: 后端推送工具执行状态变更
  unlisteners.push(
    await listen<{ toolId: string; status: string; result?: string; error?: string }>(
      "cc-tool-status",
      (event) => {
        const { toolId, status, result, error } = event.payload || {};
        if (!toolId) return;

        setMessages((prev: ChatMessage[]) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (!last) return prev;

          const result_ = [...prev];
          const idx = result_.length - 1;
          const msg = { ...result_[idx] };
          const tools = [...(msg.toolUses || [])];

          const toolIdx = tools.findIndex(t => t.id === toolId);
          if (toolIdx === -1) return prev;

          tools[toolIdx] = {
            ...tools[toolIdx],
            isPending: status === "running",
            isError: !!error,
            result: result || tools[toolIdx].result,
          };

          result_[idx] = { ...msg, toolUses: tools };
          return result_;
        });
      },
    ),
  );

  // Stream error — handles crashed subprocess / network failures
  unlisteners.push(
    await listen<{ message?: string; code?: string }>("cc-stream-error", (event) => {
      isStreamingRef.current = false;
      setStreamingActive(false);
      setIsThinking(false);
      const msg = event.payload?.message || event.payload?.code || "Stream error";
      setStatus(`错误: ${msg}`);

      setMessages((prev: ChatMessage[]) => {
        if (prev.length === 0) return prev;
        const result = [...prev];
        const last = result[result.length - 1];
        if (last?.isStreaming) {
          const { isStreaming: _isStreaming, ...rest } = result[result.length - 1];
          void _isStreaming;
          result[result.length - 1] = rest as ChatMessage;
        }
        return result;
      });

      streamingContentRef.current = "";
      streamingThinkingRef.current = "";
      streamingMessageIndexRef.current = -1;
    }),
  );

  return unlisteners;
}
