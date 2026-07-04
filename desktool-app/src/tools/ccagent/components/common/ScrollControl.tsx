// ScrollControl — 滚动控制：回到底部按钮 + 自动滚动开关

import { useState, useEffect } from "react";

export interface ScrollControlProps {
  /** 容器 ref */
  containerRef: React.RefObject<HTMLElement>;
  /** 是否流式中 */
  streaming: boolean;
}

export function ScrollControl({ containerRef, streaming }: ScrollControlProps) {
  const [showBtn, setShowBtn] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowBtn(dist > 200);
      setAutoScroll(dist <= 50);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [containerRef]);

  // 流式时若自动滚动，持续保持在底部
  useEffect(() => {
    if (!streaming || !autoScroll) return;
    const el = containerRef.current;
    if (!el) return;
    const id = setInterval(() => {
      el.scrollTop = el.scrollHeight;
    }, 100);
    return () => clearInterval(id);
  }, [streaming, autoScroll, containerRef]);

  if (!showBtn) return null;

  return (
    <button
      className="cc-scroll-control"
      onClick={() => {
        const el = containerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
        setAutoScroll(true);
        setShowBtn(false);
      }}
      title="回到底部"
    >
      ↓ {streaming ? "跟随" : "底部"}
    </button>
  );
}
