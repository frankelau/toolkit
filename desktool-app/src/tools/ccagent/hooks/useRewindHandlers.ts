// useRewindHandlers — 回退处理（对齐 cc-gui useRewindHandlers）
// Sprint A: 回退到指定消息，配合 RewindDialog 确认

import { useCallback } from "react";
import type { ChatMessage } from "../types";

interface UseRewindHandlersOptions {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  sessionId: string | null;
  onRewindReq: (req: { sessionId: string; messageId: string; messageContent: string; messageTimestamp?: number; messagesAfterCount: number }) => void;
}

export function useRewindHandlers({
  messages, setMessages, sessionId, onRewindReq,
}: UseRewindHandlersOptions) {
  /** 触发回退请求（弹确认框） */
  const requestRewind = useCallback((msg: ChatMessage) => {
    const idx = messages.findIndex(m => m.id === msg.id);
    const afterCount = messages.length - idx - 1;
    onRewindReq({
      sessionId: sessionId ?? "",
      messageId: msg.id,
      messageContent: msg.content,
      messageTimestamp: msg.timestamp,
      messagesAfterCount: afterCount,
    });
  }, [messages, sessionId, onRewindReq]);

  /** 确认回退：调后端 + 截断消息 */
  const confirmRewind = useCallback(async (messageId: string, invokeRewind?: (sessionId: string, messageId: string) => Promise<void>) => {
    if (sessionId && invokeRewind) {
      try { await invokeRewind(sessionId, messageId); } catch { /* 静默 */ }
    }
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx >= 0) {
      setMessages(prev => prev.slice(0, idx + 1));
    }
  }, [messages, sessionId, setMessages]);

  /** 简单回退 N 步（不弹确认） */
  const rewindSteps = useCallback((steps: number) => {
    setMessages(prev => prev.slice(0, Math.max(0, prev.length - steps)));
  }, [setMessages]);

  return { requestRewind, confirmRewind, rewindSteps };
}
