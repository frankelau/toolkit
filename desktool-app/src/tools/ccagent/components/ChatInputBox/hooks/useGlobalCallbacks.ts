// useGlobalCallbacks — 全局回调（键盘快捷键等）
// 对齐 cc-gui useGlobalCallbacks

import { useEffect } from "react";

export interface GlobalCallbacksOptions {
  onSubmit?: () => void;
  onAbort?: () => void;
  onSearch?: () => void;
  onNewSession?: () => void;
  onHistory?: () => void;
  onSettings?: () => void;
  disabled?: boolean;
}

export function useGlobalCallbacks(opts: GlobalCallbacksOptions) {
  useEffect(() => {
    if (opts.disabled) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "Enter" && opts.onSubmit) { e.preventDefault(); opts.onSubmit(); }
      else if (mod && e.key === "." && opts.onAbort) { e.preventDefault(); opts.onAbort(); }
      else if (mod && e.key === "f" && opts.onSearch) { e.preventDefault(); opts.onSearch(); }
      else if (mod && e.shiftKey && e.key === "n" && opts.onNewSession) { e.preventDefault(); opts.onNewSession(); }
      else if (mod && e.shiftKey && e.key === "h" && opts.onHistory) { e.preventDefault(); opts.onHistory(); }
      else if (mod && e.shiftKey && e.key === "s" && opts.onSettings) { e.preventDefault(); opts.onSettings(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opts]);
}
