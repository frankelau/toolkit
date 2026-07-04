// MessagesContext — 消息流状态（对齐 cc-gui MessagesContext）
// Sprint A: 从 CcAgent.tsx 拆出消息相关状态

import { createContext, useContext, useMemo, useState, useRef, type ReactNode } from "react";
import type { ChatMessage, SubagentInfo } from "../types";

export interface MessagesContextValue {
  // 消息列表
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  // 流式状态
  streaming: boolean;
  setStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  // 流式消息引用（不触发重渲染）
  streamingMsgRef: React.MutableRefObject<ChatMessage | null>;
  // 思考中
  isThinking: boolean;
  setIsThinking: React.Dispatch<React.SetStateAction<boolean>>;
  // 错误
  error: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
  // 子 Agent 历史
  subagentHistories: Record<string, SubagentInfo>;
  setSubagentHistories: React.Dispatch<React.SetStateAction<Record<string, SubagentInfo>>>;
}

const MessagesContext = createContext<MessagesContextValue | null>(null);

export function MessagesProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState("");
  const [subagentHistories, setSubagentHistories] = useState<Record<string, SubagentInfo>>({});
  const streamingMsgRef = useRef<ChatMessage | null>(null);

  const value = useMemo<MessagesContextValue>(
    () => ({
      messages, setMessages,
      streaming, setStreaming,
      streamingMsgRef,
      isThinking, setIsThinking,
      error, setError,
      subagentHistories, setSubagentHistories,
    }),
    [messages, streaming, isThinking, error, subagentHistories],
  );

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
}

export function useMessages(): MessagesContextValue {
  const ctx = useContext(MessagesContext);
  if (ctx === null) throw new Error("useMessages must be used within a MessagesProvider");
  return ctx;
}

export { MessagesContext };
