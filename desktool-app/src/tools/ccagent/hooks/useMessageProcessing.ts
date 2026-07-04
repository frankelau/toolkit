// useMessageProcessing — 消息处理（stream 事件解析）
// 对齐 cc-gui useMessageProcessing

import { useCallback } from "react";
import type { ChatMessage, ToolUseBlock } from "../types";
import { buildDiffForTool, redactSecrets } from "../utils";
import type { TodoItem, SubagentInfo } from "../types";

export interface MessageProcessingResult {
  handleSdkMessage: (
    msg: Record<string, unknown>,
    context: {
      streamingMsgRef: React.RefObject<ChatMessage | null>;
      setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
      pendingToolsRef: React.RefObject<Map<string, { name: string; input: Record<string, unknown> }>>;
      setTodos: React.Dispatch<React.SetStateAction<TodoItem[]>>;
      setSubagents: React.Dispatch<React.SetStateAction<SubagentInfo[]>>;
      trackFileChange: (toolName: string, input: Record<string, unknown>) => void;
    }
  ) => void;
}

export function useMessageProcessing(): MessageProcessingResult {
  const handleSdkMessage = useCallback((
    msg: Record<string, unknown>,
    ctx: {
      streamingMsgRef: React.RefObject<ChatMessage | null>;
      setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
      pendingToolsRef: React.RefObject<Map<string, { name: string; input: Record<string, unknown> }>>;
      setTodos: React.Dispatch<React.SetStateAction<TodoItem[]>>;
      setSubagents: React.Dispatch<React.SetStateAction<SubagentInfo[]>>;
      trackFileChange: (toolName: string, input: Record<string, unknown>) => void;
    }
  ) => {
    const msgType = msg.type as string;
    if (!msgType) return;

    if (msgType === "system") {
      const mdl = msg.model as string;
      const tools = msg.tools as string[];
      if (mdl) {
        ctx.setMessages(prev => [...prev, {
          id: Math.random().toString(36).slice(2),
          role: "system",
          content: `会话已启动 · 模型: ${mdl} · 工具: ${tools?.length ?? 0} 个`,
          timestamp: Date.now(),
        }]);
      }
      return;
    }

    if (msgType === "assistant") {
      const message = msg.message as Record<string, unknown>;
      const content = message?.content as Array<Record<string, unknown>>;
      if (!content) return;

      let textContent = "";
      let thinking = "";
      const toolUses: ToolUseBlock[] = [];

      for (const block of content) {
        if (block.type === "text") {
          textContent += block.text as string;
        } else if (block.type === "thinking") {
          thinking += block.thinking as string;
        } else if (block.type === "tool_use") {
          const input = (block.input ?? {}) as Record<string, unknown>;
          const toolName = block.name as string;
          const toolId = block.id as string;
          toolUses.push({
            id: toolId, name: toolName, input,
            isPending: true,
            diff: buildDiffForTool(toolName, input),
          });
          ctx.pendingToolsRef.current?.set(toolId, { name: toolName, input });
          if (toolName === "TodoWrite" && Array.isArray(input.todos)) {
            ctx.setTodos((input.todos as Array<{ id?: string; content: string; status: TodoItem['status'] }>).map(t => ({
              id: t.id, content: t.content, status: t.status || 'pending',
            })));
          }
          if (toolName === "Agent") {
            const description = String(input.description || input.prompt || "").slice(0, 60);
            const subagentType = String(input.subagent_type || "Agent");
            ctx.setSubagents(prev => [...prev, {
              id: toolId, type: subagentType, description,
              prompt: input.prompt as string | undefined,
              status: 'running',
            }]);
          }
        }
      }

      if (ctx.streamingMsgRef.current && !ctx.streamingMsgRef.current.content && !ctx.streamingMsgRef.current.toolUses?.length) {
        ctx.streamingMsgRef.current.content = textContent;
        ctx.streamingMsgRef.current.thinking = thinking;
        ctx.streamingMsgRef.current.toolUses = toolUses;
        ctx.setMessages(prev => [...prev]);
      } else {
        if (ctx.streamingMsgRef.current) ctx.streamingMsgRef.current.isStreaming = false;
        const assistantMsg: ChatMessage = {
          id: Math.random().toString(36).slice(2),
          role: "assistant",
          content: textContent, thinking, toolUses, isStreaming: true,
          timestamp: Date.now(),
        };
        ctx.streamingMsgRef.current = assistantMsg;
        ctx.setMessages(prev => [...prev, assistantMsg]);
      }
      return;
    }

    if (msgType === "user") {
      const message = msg.message as Record<string, unknown>;
      const content = message?.content as Array<Record<string, unknown>>;
      if (!content) return;

      for (const block of content) {
        if (block.type === "tool_result") {
          const toolUseId = block.tool_use_id as string;
          const resultContent = block.content as string | Array<Record<string, unknown>>;
          const resultText = typeof resultContent === "string"
            ? resultContent
            : Array.isArray(resultContent)
              ? resultContent.map(c => c.text ?? "").join("")
              : "";
          const isError = block.is_error === true;

          if (ctx.streamingMsgRef.current?.toolUses) {
            const tu = ctx.streamingMsgRef.current.toolUses.find(t => t.id === toolUseId);
            if (tu) {
              tu.result = redactSecrets(resultText);
              tu.isPending = false;
              tu.isError = isError;
              ctx.setMessages(prev => [...prev]);
            }
          }

          const pending = ctx.pendingToolsRef.current?.get(toolUseId);
          if (pending) {
            ctx.pendingToolsRef.current?.delete(toolUseId);
            const { name: toolName, input } = pending;

            if (toolName === "Agent") {
              ctx.setSubagents(prev => prev.map(s => s.id === toolUseId
                ? { ...s, status: isError ? 'error' : 'completed', resultText: resultText.slice(0, 300) }
                : s));
            }

            if (!isError && (toolName === "Write" || toolName === "Edit" || toolName === "MultiEdit")) {
              ctx.trackFileChange(toolName, input);
            }
          }
        }
      }
      return;
    }
  }, []);

  return { handleSdkMessage };
}
