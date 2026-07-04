// useWindowCallbacks — 窗口回调（focus/blur/beforeunload）
// 对齐 cc-gui useWindowCallbacks

import { useEffect } from "react";

export interface WindowCallbacks {
  onFocus?: () => void;
  onBlur?: () => void;
  onBeforeUnload?: () => void;
  onResize?: () => void;
}

export function useWindowCallbacks(callbacks: WindowCallbacks) {
  const { onFocus, onBlur, onBeforeUnload, onResize } = callbacks;

  useEffect(() => {
    const handlers: Array<[keyof WindowEventMap, () => void]> = [];
    if (onFocus) { window.addEventListener("focus", onFocus); handlers.push(["focus", onFocus]); }
    if (onBlur) { window.addEventListener("blur", onBlur); handlers.push(["blur", onBlur]); }
    if (onResize) { window.addEventListener("resize", onResize); handlers.push(["resize", onResize]); }
    if (onBeforeUnload) { window.addEventListener("beforeunload", onBeforeUnload); handlers.push(["beforeunload", onBeforeUnload]); }
    return () => handlers.forEach(([evt, fn]) => window.removeEventListener(evt, fn));
  }, [onFocus, onBlur, onBeforeUnload, onResize]);
}

/** 检测窗口是否可见 */
export function useWindowVisibility(): boolean {
  // 简化实现，实际可以用 useState + visibilitychange
  return !document.hidden;
}
