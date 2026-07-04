// useKeyboardNavigation — 键盘导航（补全列表）
// 对齐 cc-gui useKeyboardNavigation

import { useCallback } from "react";

export interface KeyboardNavOptions {
  itemCount: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onConfirm: (index: number) => void;
  onCancel: () => void;
}

export function useKeyboardNavigation(opts: KeyboardNavOptions) {
  return useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        opts.onSelect((opts.selectedIndex + 1) % Math.max(1, opts.itemCount));
        break;
      case "ArrowUp":
        e.preventDefault();
        opts.onSelect(opts.selectedIndex === 0 ? Math.max(0, opts.itemCount - 1) : opts.selectedIndex - 1);
        break;
      case "Enter":
        if (opts.itemCount > 0) {
          e.preventDefault();
          opts.onConfirm(opts.selectedIndex);
        }
        break;
      case "Tab":
        if (opts.itemCount > 0) {
          e.preventDefault();
          opts.onConfirm(opts.selectedIndex);
        }
        break;
      case "Escape":
        e.preventDefault();
        opts.onCancel();
        break;
    }
  }, [opts]);
}
