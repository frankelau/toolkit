// useScrollBehavior — 自动滚动 + 锚点（对齐 cc-gui）
// Sprint A: 消息列表自动滚动到底部，流式时跟随

import { useEffect, useRef } from "react";

interface UseScrollBehaviorOptions {
  messages: unknown[];
  streaming: boolean;
  /** 底部 ref */
  bottomRef: React.RefObject<HTMLDivElement | null>;
  /** 容器 ref（可选） */
  containerRef?: React.RefObject<HTMLDivElement | null>;
  /** 是否启用自动滚动（用户手动滚动后暂停） */
  enabled?: boolean;
}

export function useScrollBehavior({
  messages, streaming, bottomRef, containerRef, enabled = true,
}: UseScrollBehaviorOptions) {
  const autoScrollRef = useRef(true);
  const lastMsgCountRef = useRef(0);

  // 检测用户是否手动向上滚动
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;
    const onScroll = () => {
      const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      autoScrollRef.current = distFromBottom < 80;
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [containerRef]);

  // 消息数变化或流式时滚动到底
  useEffect(() => {
    if (!enabled) return;
    const msgCount = messages.length;
    const isNewMessage = msgCount > lastMsgCountRef.current;
    lastMsgCountRef.current = msgCount;

    if (autoScrollRef.current && (isNewMessage || streaming)) {
      // 用 requestAnimationFrame 确保 DOM 更新后再滚
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: streaming ? "auto" : "smooth", block: "end" });
      });
    }
  }, [messages, streaming, enabled, bottomRef]);

  /** 强制滚动到底（如点击"跳转最新"按钮） */
  function scrollToBottom() {
    autoScrollRef.current = true;
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }

  return { autoScrollRef, scrollToBottom };
}
