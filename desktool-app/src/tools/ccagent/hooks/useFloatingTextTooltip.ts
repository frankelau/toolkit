// useFloatingTextTooltip — 浮动文本提示
// 对齐 cc-gui useFloatingTextTooltip

import { useState, useCallback, useRef } from "react";

export interface TooltipState {
  visible: boolean;
  text: string;
  x: number;
  y: number;
  show: (text: string, x: number, y: number) => void;
  hide: () => void;
}

export function useFloatingTextTooltip(
  delay: number = 300
): TooltipState {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef<number | null>(null);

  const show = useCallback((t: string, x: number, y: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setText(t);
      setPos({ x, y });
      setVisible(true);
    }, delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  return { visible, text, x: pos.x, y: pos.y, show, hide };
}
