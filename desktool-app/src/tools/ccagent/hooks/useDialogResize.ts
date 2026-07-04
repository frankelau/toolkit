// useDialogResize — 弹窗缩放
// 对齐 cc-gui useDialogResize

import { useState, useCallback, type RefObject } from "react";

export interface DialogResizeState {
  width: number;
  height: number;
  isResizing: boolean;
  startResize: (e: React.MouseEvent) => void;
}

const MIN_WIDTH = 320;
const MIN_HEIGHT = 200;
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 900;

export function useDialogResize(
  initialWidth: number = 480,
  initialHeight: number = 400,
  _containerRef?: RefObject<HTMLElement | null>
): DialogResizeState {
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(initialHeight);
  const [isResizing, setIsResizing] = useState(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = width;
    const startH = height;

    const onMove = (ev: MouseEvent) => {
      const dx = startX - ev.clientX;
      const dy = startY - ev.clientY;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + dx)));
      setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startH + dy)));
    };
    const onUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [width, height]);

  return { width, height, isResizing, startResize };
}
