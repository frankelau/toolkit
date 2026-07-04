// useSettingsWindowCallbacks — 设置窗口回调
// 对齐 cc-gui useSettingsWindowCallbacks

import { useEffect } from "react";

export interface SettingsWindowCallbacks {
  onClose?: () => void;
  onSave?: () => void;
  onReset?: () => void;
  enabled?: boolean;
}

export function useSettingsWindowCallbacks(callbacks: SettingsWindowCallbacks) {
  const { onClose, onSave, onReset, enabled = true } = callbacks;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) { e.preventDefault(); onClose(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && onSave) { e.preventDefault(); onSave(); }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "r" && onReset) { e.preventDefault(); onReset(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onSave, onReset, enabled]);
}
