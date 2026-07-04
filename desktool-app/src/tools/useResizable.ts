import { useRef, useState } from "react";

/**
 * 可拖拽调整高度的输入区。返回当前高度与把手的 onMouseDown。
 * 用法：<textarea style={{ height }} /> 后接 <div onMouseDown={onHandleDown} />
 */
export function useResizable(initial = 150, min = 60) {
  const [height, setHeight] = useState(initial);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  function onHandleDown(e: React.MouseEvent) {
    dragRef.current = { startY: e.clientY, startH: height };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setHeight(Math.max(min, dragRef.current.startH + ev.clientY - dragRef.current.startY));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return { height, onHandleDown };
}
