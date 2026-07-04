// useInlineHistoryCompletion — 内联历史补全
// 对齐 cc-gui useInlineHistoryCompletion

import { useState, useCallback, type RefObject } from "react";

export interface InlineHistoryState {
  historyIdx: number;
  savedInput: string;
  navigatePrev: () => void;
  navigateNext: () => void;
  reset: () => void;
}

export function useInlineHistoryCompletion(
  history: string[],
  value: string,
  setValue: (v: string) => void,
  textareaRef?: RefObject<HTMLTextAreaElement | null>
): InlineHistoryState {
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [savedInput, setSavedInput] = useState("");

  const navigatePrev = useCallback(() => {
    if (history.length === 0) return;
    if (historyIdx === -1) {
      setSavedInput(value);
      setHistoryIdx(history.length - 1);
      setValue(history[history.length - 1]);
    } else if (historyIdx > 0) {
      setHistoryIdx(historyIdx - 1);
      setValue(history[historyIdx - 1]);
    }
    requestAnimationFrame(() => {
      const ta = textareaRef?.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    });
  }, [history, historyIdx, value, setValue, textareaRef]);

  const navigateNext = useCallback(() => {
    if (historyIdx === -1) return;
    if (historyIdx + 1 >= history.length) {
      setHistoryIdx(-1);
      setValue(savedInput);
    } else {
      setHistoryIdx(historyIdx + 1);
      setValue(history[historyIdx + 1]);
    }
    requestAnimationFrame(() => {
      const ta = textareaRef?.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    });
  }, [history, historyIdx, savedInput, setValue, textareaRef]);

  const reset = useCallback(() => {
    setHistoryIdx(-1);
    setSavedInput("");
  }, []);

  return { historyIdx, savedInput, navigatePrev, navigateNext, reset };
}
