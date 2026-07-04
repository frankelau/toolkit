// MessageList — 消息列表容器（含虚拟滚动兜底 + 自动滚动锚点）

import { useEffect, useRef, type ReactNode } from "react";

export interface MessageListProps {
  children: ReactNode;
  /** 是否流式中 */
  streaming: boolean;
  /** 当前消息数（用于触发自动滚动） */
  messageCount: number;
  /** 最后一条消息的 id */
  lastMessageId?: string;
  /** 是否启用自动滚动（用户主动上滑后临时关闭） */
  autoScrollEnabled: boolean;
  onAutoScrollChange?: (enabled: boolean) => void;
  /** 空状态文案 */
  emptyHint?: ReactNode;
  /** 是否空 */
  isEmpty: boolean;
}

export function MessageList(props: MessageListProps) {
  const {
    children, streaming, messageCount, lastMessageId,
    autoScrollEnabled, onAutoScrollChange, emptyHint, isEmpty,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  // 自动滚动：新消息或流式更新时
  useEffect(() => {
    if (!autoScrollEnabled) return;
    if (messageCount === lastCountRef.current && !streaming) return;
    lastCountRef.current = messageCount;
    bottomRef.current?.scrollIntoView({ behavior: messageCount > 5 ? "auto" : "smooth", block: "end" });
  }, [messageCount, lastMessageId, streaming, autoScrollEnabled]);

  // 用户主动滚动检测：上滑超过 80px 则关闭自动滚动
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distFromBottom > 80 && autoScrollEnabled) {
        onAutoScrollChange?.(false);
      } else if (distFromBottom <= 20 && !autoScrollEnabled) {
        onAutoScrollChange?.(true);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [autoScrollEnabled, onAutoScrollChange]);

  // "回到底部"按钮点击
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    onAutoScrollChange?.(true);
  };

  if (isEmpty) {
    return (
      <div className="cc-message-list cc-message-list-empty" ref={containerRef}>
        {emptyHint ?? <div className="cc-empty-hint">开始一段新对话</div>}
      </div>
    );
  }

  return (
    <div className="cc-message-list" ref={containerRef}>
      {children}
      <div ref={bottomRef} className="cc-message-list-bottom-anchor" />
      {!autoScrollEnabled && (
        <button className="cc-scroll-to-bottom" onClick={scrollToBottom} title="回到底部">
          ↓
        </button>
      )}
    </div>
  );
}
