// useSpaceKeyListener — 空格键监听（用于触发补全等）
// 对齐 cc-gui useSpaceKeyListener

import { useEffect } from "react";

export function useSpaceKeyListener(
  onSpace: () => void,
  enabled: boolean = true,
  requireModifier: boolean = false
) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " && (!requireModifier || e.ctrlKey || e.metaKey)) {
        onSpace();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSpace, enabled, requireModifier]);
}
