// useResizableChatInputBox — 可缩放输入框
// 对齐 cc-gui useResizableChatInputBox

import { useState, useCallback, useEffect, type RefObject } from "react";

const MIN_ROWS = 3;
const MAX_ROWS = 40;
const DEFAULT_ROWS = 4;

export interface ResizableInputState {
  rows: number;
  isResizing: boolean;
  startResize: (e: React.MouseEvent) => void;
  setRows: (n: number) => void;
  resetSize: () => void;
}

export function useResizableChatInputBox(
  textareaRef?: RefObject<HTMLTextAreaElement | null>,
  initialRows: number = DEFAULT_ROWS
): ResizableInputState {
  const [rows, setRows] = useState(initialRows);
  const [isResizing, setIsResizing] = useState(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startY = e.clientY;
    const startRows = rows;
    const lineHeight = 20; // approx

    const onMove = (ev: MouseEvent) => {
      const dy = startY - ev.clientY;
      const deltaRows = Math.round(dy / lineHeight);
      const newRows = Math.min(MAX_ROWS, Math.max(MIN_ROWS, startRows + deltaRows));
      setRows(newRows);
    };
    const onUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [rows]);

  const resetSize = useCallback(() => setRows(DEFAULT_ROWS), []);

  // 根据内容自动调整（但有上限）
  useEffect(() => {
    const ta = textareaRef?.current;
    if (!ta) return;
    const lineCount = ta.value.split("\n").length;
    if (lineCount > rows && lineCount <= MAX_ROWS) {
      setRows(lineCount);
    }
  }, [textareaRef, rows]);

  return { rows, isResizing, startResize, setRows, resetSize };
}
