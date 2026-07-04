// useStreamingMessages — 流式消息处理（对齐 cc-gui useStreamingMessages）
// Sprint A: 处理 bridge 推送的 stream 事件，解析 content blocks，更新当前流式消息

import { useCallback, useRef } from "react";
import type { ChatMessage, ToolUseBlock, TodoItem, SubagentInfo, PermissionRequest } from "../types";
import { buildDiffForTool } from "../utils";

interface UseStreamingMessagesOptions {
  streamingMsgRef: React.MutableRefObject<ChatMessage | null>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setStreaming: (v: boolean) => void;
  setIsThinking: (v: boolean) => void;
  setTodos: React.Dispatch<React.SetStateAction<TodoItem[]>>;
  setSubagents: React.Dispatch<React.SetStateAction<SubagentInfo[]>>;
  onPermissionRequest?: (req: PermissionRequest) => void;
}

interface SdkMessage {
  type: string;
  [key: string]: unknown;
}

export function useStreamingMessages({
  streamingMsgRef, setMessages, setStreaming, setIsThinking,
  setTodos, setSubagents, onPermissionRequest,
}: UseStreamingMessagesOptions) {
  const pendingToolsRef = useRef<Map<string, { name: string; input: Record<string, unknown> }>>(new Map());

  /** 处理 SDK 推送的单条 stream 消息 */
  const handleSdkMessage = useCallback((msg: SdkMessage) => {
    const streamingMsg = streamingMsgRef.current;
    if (!streamingMsg) return;

    switch (msg.type) {
      case "system":
        // 初始化
        break;

      case "assistant": {
        const content = (msg.message as { content?: unknown[] })?.content;
        if (!Array.isArray(content)) break;

        let textContent = "";
        let thinking = "";
        const newToolUses: ToolUseBlock[] = [];

        for (const block of content) {
          const b = block as { type?: string; [k: string]: unknown };
          if (b.type === "text" && typeof b.text === "string") {
            textContent += b.text;
          } else if (b.type === "thinking" && typeof b.thinking === "string") {
            thinking += b.thinking;
            setIsThinking(true);
          } else if (b.type === "tool_use") {
            const tu = {
              id: String(b.id ?? ""),
              name: String(b.name ?? ""),
              input: (b.input as Record<string, unknown>) ?? {},
              isPending: true,
              diff: buildDiffForTool(String(b.name ?? ""), (b.input as Record<string, unknown>) ?? {}),
            };
            newToolUses.push(tu);
            pendingToolsRef.current.set(tu.id, { name: tu.name, input: tu.input });

            // TodoWrite 特殊处理
            if (tu.name === "TodoWrite" && Array.isArray(tu.input.todos)) {
              setTodos((tu.input.todos as TodoItem[]));
            }
            // Agent 工具：创建子 Agent
            if (["Agent", "Task", "Explore"].includes(tu.name)) {
              setSubagents(prev => [...prev, {
                id: tu.id,
                type: tu.name,
                description: String(tu.input.description ?? tu.input.subagent_type ?? tu.name),
                prompt: tu.input.prompt as string | undefined,
                status: "running",
              }]);
            }
          } else if (b.type === "tool_result") {
            const toolUseId = String(b.tool_use_id ?? "");
            const result = typeof b.content === "string" ? b.content : JSON.stringify(b.content ?? "");
            const isError = Boolean(b.is_error);
            // 更新流式消息里的 toolUse
            if (streamingMsg.toolUses) {
              const idx = streamingMsg.toolUses.findIndex(t => t.id === toolUseId);
              if (idx >= 0) {
                streamingMsg.toolUses[idx].result = result.slice(0, 5000);
                streamingMsg.toolUses[idx].isPending = false;
                streamingMsg.toolUses[idx].isError = isError;
              }
            }
            // 更新子 Agent 状态
            setSubagents(prev => prev.map(s => s.id === toolUseId ? {
              ...s, status: isError ? "error" : "completed", resultText: result.slice(0, 2000),
            } : s));
            pendingToolsRef.current.delete(toolUseId);
          }
        }

        streamingMsg.content = textContent;
        if (thinking) streamingMsg.thinking = (streamingMsg.thinking || "") + thinking;
        if (newToolUses.length) {
          streamingMsg.toolUses = [...(streamingMsg.toolUses || []), ...newToolUses];
        }
        setMessages(prev => [...prev]);
        break;
      }

      case "result":
        // 流结束
        break;

      case "user":
        // 用户消息（轮次）
        break;
    }
  }, [streamingMsgRef, setMessages, setIsThinking, setTodos, setSubagents]);

  /** 处理 bridge 顶层事件（type=stream/permission_request/result 等） */
  const handleStreamEvent = useCallback((data: Record<string, unknown>) => {
    const type = data.type as string;
    if (!type) return;

    if (type === "permission_request") {
      onPermissionRequest?.({
        toolUseId: data.toolUseId as string,
        toolName: data.toolName as string,
        input: data.input as Record<string, unknown>,
      });
      return;
    }

    if (type === "stream") {
      const msg = data.data as SdkMessage;
      if (msg) handleSdkMessage(msg);
      return;
    }

    if (type === "result") {
      const streamingMsg = streamingMsgRef.current;
      if (streamingMsg) {
        streamingMsg.isStreaming = false;
        const costUsd = data.costUsd as number;
        const usage = data.usage as Record<string, number>;
        streamingMsg.usage = {
          costUsd,
          inputTokens: usage?.input_tokens,
          outputTokens: usage?.output_tokens,
          cacheReadTokens: usage?.cache_read_input_tokens,
          cacheCreateTokens: usage?.cache_creation_input_tokens,
          durationMs: data.durationMs as number,
        };
        setMessages(prev => [...prev]);
        streamingMsgRef.current = null;
      }
      setStreaming(false);
      setIsThinking(false);
      return;
    }

    if (type === "stream_end") {
      setStreaming(false);
      setIsThinking(false);
      if (streamingMsgRef.current) {
        streamingMsgRef.current.isStreaming = false;
        streamingMsgRef.current.content = streamingMsgRef.current.content || "(无响应)";
        setMessages(prev => [...prev]);
        streamingMsgRef.current = null;
      }
      return;
    }

    if (type === "error") {
      setStreaming(false);
      setIsThinking(false);
      if (streamingMsgRef.current) {
        streamingMsgRef.current.isStreaming = false;
        streamingMsgRef.current.content = `❌ 错误: ${data.message || "未知错误"}`;
        setMessages(prev => [...prev]);
        streamingMsgRef.current = null;
      }
      return;
    }
  }, [handleSdkMessage, streamingMsgRef, setMessages, setStreaming, setIsThinking, onPermissionRequest]);

  return {
    handleStreamEvent,
    handleSdkMessage,
    pendingToolsRef,
  };
}
