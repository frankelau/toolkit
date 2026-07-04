// useKeyboardHandler — 输入框键盘处理（对齐 cc-gui useKeyboardHandler）
// Sprint B: 统一处理 Enter/Ctrl+Enter/↑↓/Esc/Tab/补全导航

import { useCallback } from "react";
import type { UseIMECompositionReturn } from "./useIMEComposition";
import type { UseCompletionDropdownReturn } from "./useCompletionDropdown";

interface UseKeyboardHandlerOptions {
  ime: UseIMECompositionReturn;
  completion: UseCompletionDropdownReturn;
  onSend: () => void;
  onAbort: () => void;
  /** ↑↓ 历史导航 */
  onHistoryKeyDown: (e: { key: string; preventDefault: () => void; stopPropagation: () => void }) => boolean;
  /** 选中补全项 */
  onSelectCompletion: () => void;
  /** 关闭补全/搜索 */
  onClose: () => void;
  /** 发送快捷键：true=Enter发送(Ctrl+Enter换行)，false=Ctrl+Enter发送(Enter换行) */
  enterToSend?: boolean;
}

export function useKeyboardHandler({
  ime, completion, onSend, onAbort, onHistoryKeyDown, onSelectCompletion, onClose,
  enterToSend = true,
}: UseKeyboardHandlerOptions) {
  return useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // IME 组合中不处理
    if (ime.checkComposing()) return;

    // 补全下拉打开时
    if (completion.isOpen) {
      if (e.key === "ArrowDown") { e.preventDefault(); completion.selectNext(); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); completion.selectPrev(); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        onSelectCompletion();
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); completion.close(); return; }
      return;
    }

    // Esc 关闭搜索等
    if (e.key === "Escape") { onClose(); return; }

    // 发送
    const isEnter = e.key === "Enter";
    const withCtrl = e.ctrlKey || e.metaKey;
    if (enterToSend) {
      // Enter 发送，Ctrl+Enter 换行
      if (isEnter && !e.shiftKey && !withCtrl) {
        e.preventDefault();
        onSend();
        return;
      }
    } else {
      // Ctrl+Enter 发送，Enter 换行
      if (isEnter && withCtrl) {
        e.preventDefault();
        onSend();
        return;
      }
    }

    // 停止生成（Ctrl+C 或 Ctrl+. 在流式中）
    if (e.key === "." && withCtrl) { e.preventDefault(); onAbort(); return; }

    // ↑↓ 历史导航
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const handled = onHistoryKeyDown({
        key: e.key,
        preventDefault: () => e.preventDefault(),
        stopPropagation: () => e.stopPropagation(),
      });
      if (handled) return;
    }
  }, [ime, completion, onSend, onAbort, onHistoryKeyDown, onSelectCompletion, onClose, enterToSend]);
}
