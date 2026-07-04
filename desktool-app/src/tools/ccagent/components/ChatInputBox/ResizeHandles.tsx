// ResizeHandles — 缩放手柄（对齐 cc-gui ResizeHandles）
// Sprint B: 输入框上下缩放手柄

import { useRef, useCallback, useState } from "react";

interface ResizeHandlesProps {
  minRows?: number;
  maxRows?: number;
  rows: number;
  onRowsChange: (rows: number) => void;
}

export function ResizeHandles({
  minRows = 3, maxRows = 40, rows, onRowsChange,
}: ResizeHandlesProps) {
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startRowsRef = useRef(rows);
  const [isHover, setIsHover] = useState(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    startYRef.current = e.clientY;
    startRowsRef.current = rows;

    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = startYRef.current - ev.clientY;
      const rowHeight = 20; // 估算行高
      const deltaRows = Math.round(delta / rowHeight);
      const newRows = Math.max(minRows, Math.min(maxRows, startRowsRef.current + deltaRows));
      onRowsChange(newRows);
    };
    const onUp = () => {
      draggingRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [rows, minRows, maxRows, onRowsChange]);

  return (
    <div
      className="cc-input-resize-handle"
      onMouseDown={onMouseDown}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      style={{ background: isHover || draggingRef.current ? "var(--border, #333)" : "transparent" }}
    />
  );
}
