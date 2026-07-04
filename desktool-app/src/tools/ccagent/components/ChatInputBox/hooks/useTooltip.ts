// useTooltip — 通用 tooltip
// 对齐 cc-gui useTooltip

import { useState, useCallback, useRef } from "react";

export interface TooltipInfo {
  visible: boolean;
  content: string;
  show: (content: string) => void;
  hide: () => void;
}

export function useTooltip(delay: number = 500): TooltipInfo {
  const [visible, setVisible] = useState(false);
  const [content, setContent] = useState("");
  const timerRef = useRef<number | null>(null);

  const show = useCallback((c: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setContent(c);
      setVisible(true);
    }, delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  return { visible, content, show, hide };
}
