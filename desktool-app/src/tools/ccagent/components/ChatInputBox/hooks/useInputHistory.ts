// useInputHistory — 输入历史导航（对齐 cc-gui useInputHistory）
// Sprint B: ↑↓ 键在历史输入间导航，localStorage 持久化

import { useCallback, useEffect, useRef } from "react";
import {
  INVISIBLE_CHARS_RE, MAX_HISTORY_ITEMS, splitTextToFragments,
  canUseLocalStorage, loadHistory, loadCounts, saveHistory,
  saveTimestamps, cleanupCounts,
} from "./inputHistoryStorage";

type KeyEventLike = {
  key: string;
  metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean;
  preventDefault: () => void; stopPropagation: () => void;
};

export interface UseInputHistoryOptions {
  getTextContent: () => string;
  setTextContent: (text: string) => void;
  /** 可选：同步到后端 */
  onRecord?: (fragments: string[]) => void;
}

export interface UseInputHistoryReturn {
  record: (text: string) => void;
  handleKeyDown: (e: KeyEventLike) => boolean;
  historyRef: React.RefObject<string[]>;
}

export function useInputHistory({
  getTextContent, setTextContent, onRecord,
}: UseInputHistoryOptions): UseInputHistoryReturn {
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const draftRef = useRef<string>("");

  useEffect(() => {
    historyRef.current = loadHistory();
  }, []);

  const record = useCallback((text: string) => {
    const sanitized = text.replace(INVISIBLE_CHARS_RE, "");
    if (!sanitized.trim()) return;

    const fragments = splitTextToFragments(sanitized);
    if (fragments.length === 0) return;

    // 使用计数 + 时间戳
    if (canUseLocalStorage()) {
      try {
        let counts = loadCounts();
        for (const f of fragments) counts[f] = (counts[f] || 0) + 1;
        counts = cleanupCounts(counts);
        window.localStorage.setItem("ccagent:inputHistoryCounts", JSON.stringify(counts));
        saveTimestamps(fragments);
      } catch { /* ignore */ }
    }

    const current = historyRef.current;
    const newSet = new Set(fragments);
    const filtered = current.filter(item => !newSet.has(item));
    const newItems = [...filtered, ...fragments].slice(-MAX_HISTORY_ITEMS);
    historyRef.current = saveHistory(newItems);
    historyIndexRef.current = -1;
    draftRef.current = "";

    onRecord?.(fragments);
  }, [onRecord]);

  const handleKeyDown = useCallback((e: KeyEventLike): boolean => {
    const key = e.key;
    if (historyIndexRef.current !== -1 && key !== "ArrowUp" && key !== "ArrowDown") {
      historyIndexRef.current = -1;
      draftRef.current = "";
      return false;
    }
    if (key !== "ArrowUp" && key !== "ArrowDown") return false;
    if (e.metaKey || e.ctrlKey || e.altKey) return false;

    const items = historyRef.current;
    if (items.length === 0) return false;

    const currentText = getTextContent();
    const cleanCurrent = currentText.replace(INVISIBLE_CHARS_RE, "").trim();
    const isNavigating = historyIndexRef.current !== -1;

    if (!isNavigating && cleanCurrent) return false;
    if (!isNavigating && key === "ArrowDown") return false;

    e.preventDefault();
    e.stopPropagation();

    if (!isNavigating) draftRef.current = currentText;

    if (key === "ArrowUp") {
      const nextIndex = isNavigating ? Math.max(0, historyIndexRef.current - 1) : items.length - 1;
      historyIndexRef.current = nextIndex;
      setTextContent(items[nextIndex]);
      return true;
    }

    // ArrowDown
    if (!isNavigating) return true;
    if (historyIndexRef.current < items.length - 1) {
      historyIndexRef.current += 1;
      setTextContent(items[historyIndexRef.current]);
      return true;
    }
    historyIndexRef.current = -1;
    setTextContent(draftRef.current);
    draftRef.current = "";
    return true;
  }, [getTextContent, setTextContent]);

  return { record, handleKeyDown, historyRef };
}
