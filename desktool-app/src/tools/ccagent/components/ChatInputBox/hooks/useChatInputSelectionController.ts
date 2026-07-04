// useChatInputSelectionController — 选区控制
// 对齐 cc-gui useChatInputSelectionController

import { useState, useCallback, type RefObject } from "react";

export interface SelectionState {
  start: number;
  end: number;
  hasSelection: boolean;
  updateSelection: () => void;
  getSelectedText: () => string;
  setSelection: (start: number, end: number) => void;
}

export function useChatInputSelectionController(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  value: string
): SelectionState {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);

  const updateSelection = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    setStart(ta.selectionStart);
    setEnd(ta.selectionEnd);
  }, [textareaRef]);

  const getSelectedText = useCallback(() => {
    if (start === end) return "";
    return value.slice(start, end);
  }, [start, end, value]);

  const setSelection = useCallback((s: number, e: number) => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(s, e);
    setStart(s);
    setEnd(e);
  }, [textareaRef]);

  return {
    start, end,
    hasSelection: start !== end,
    updateSelection, getSelectedText, setSelection,
  };
}
