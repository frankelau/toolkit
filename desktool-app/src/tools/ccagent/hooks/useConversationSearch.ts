// useConversationSearch — 对话内搜索（对齐 cc-gui useConversationSearch）
// Sprint A: 搜索消息内容，支持正则/大小写/全词，上一个/下一个导航
// Sprint U3: 扩展支持 SearchOptions + containerRef + messagesSignal + ensureRevealed

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "../types";

export interface SearchOptions {
  matchCase: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  matchCase: false,
  wholeWord: false,
  regex: false,
};

export interface ConversationSearchMatch {
  id: string;
  markElement: HTMLElement | null;
  blockElement: HTMLElement | null;
  preview?: string;
}

interface UseConversationSearchOptions {
  /** 消息列表（旧 API，兼容） */
  messages?: ChatMessage[];
  /** DOM 容器（新 API，用于 DOM 级搜索） */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** 消息变化信号（触发重新扫描） */
  messagesSignal?: string | number;
  /** 强制展开折叠消息的回调 */
  ensureRevealed?: () => number;
  /** 是否启用搜索 */
  enabled?: boolean;
  /** 搜索选项 */
  searchOptions?: SearchOptions;
}

interface UseConversationSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  matches: ConversationSearchMatch[];
  currentIndex: number;
  next: () => void;
  previous: () => void;
  goToIndex: (idx: number) => void;
  isSearching: boolean;
  expandedCount: number;
  isRegexInvalid: boolean;
  clear: () => void;
  // 旧 API 兼容字段
  useRegex: boolean;
  setUseRegex: (v: boolean) => void;
  caseSensitive: boolean;
  setCaseSensitive: (v: boolean) => void;
  goToNext: () => void;
  goToPrev: () => void;
  totalMatches: number;
}

export function useConversationSearch(options: UseConversationSearchOptions): UseConversationSearchReturn {
  const {
    messages = [],
    containerRef,
    messagesSignal,
    ensureRevealed,
    enabled = true,
    searchOptions = DEFAULT_SEARCH_OPTIONS,
  } = options;

  const [query, setQuery] = useState("");
  const [useRegex, setUseRegex] = useState(searchOptions.regex);
  const [caseSensitive, setCaseSensitive] = useState(searchOptions.matchCase);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedCount, setExpandedCount] = useState(0);
  const [domMatches, setDomMatches] = useState<ConversationSearchMatch[]>([]);
  const searchTimerRef = useRef<number | undefined>(undefined);

  const isRegexInvalid = useMemo(() => {
    if (!searchOptions.regex || !query.trim()) return false;
    try {
      new RegExp(query);
      return false;
    } catch {
      return true;
    }
  }, [query, searchOptions.regex]);

  // 消息级搜索（旧 API）
  const messageMatches = useMemo(() => {
    if (!query.trim() || isRegexInvalid) return [];
    let regex: RegExp;
    try {
      const pattern = searchOptions.regex
        ? query
        : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const flags = searchOptions.matchCase ? "g" : "gi";
      regex = new RegExp(
        searchOptions.wholeWord ? `\\b${pattern}\\b` : pattern,
        flags,
      );
    } catch {
      return [];
    }
    return messages.reduce<number[]>((acc, m, i) => {
      const haystack = `${m.content}\n${m.thinking ?? ""}`;
      if (regex.test(haystack)) acc.push(i);
      return acc;
    }, []);
  }, [messages, query, searchOptions, isRegexInvalid]);

  // DOM 级搜索（新 API）
  useEffect(() => {
    if (!enabled || !query.trim() || isRegexInvalid) {
      setDomMatches([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    // 展开折叠消息
    if (ensureRevealed) {
      const count = ensureRevealed();
      setExpandedCount(count);
    }

    // 防抖搜索
    if (searchTimerRef.current !== undefined) {
      window.clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = window.setTimeout(() => {
      const container = containerRef?.current;
      if (!container) {
        setIsSearching(false);
        return;
      }

      let regex: RegExp;
      try {
        const pattern = searchOptions.regex
          ? query
          : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const flags = searchOptions.matchCase ? "g" : "gi";
        regex = new RegExp(
          searchOptions.wholeWord ? `\\b${pattern}\\b` : pattern,
          flags,
        );
      } catch {
        setIsSearching(false);
        return;
      }

      // 清除之前的 <mark>
      container.querySelectorAll("mark.cc-search-mark").forEach((m) => {
        const parent = m.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(m.textContent || ""), m);
          parent.normalize();
        }
      });

      // 遍历文本节点
      const matches: ConversationSearchMatch[] = [];
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          // 跳过 script/style/mark
          if (parent.tagName === "SCRIPT" || parent.tagName === "STYLE" || parent.tagName === "MARK") {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      let matchId = 0;
      let textNode: Text | null;
      while ((textNode = walker.nextNode() as Text | null)) {
        const text = textNode.nodeValue || "";
        if (!text.trim()) continue;

        regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
          const mark = document.createElement("mark");
          mark.className = "cc-search-mark";
          mark.textContent = match[0];

          const range = document.createRange();
          range.setStart(textNode, match.index);
          range.setEnd(textNode, match.index + match[0].length);
          range.deleteContents();
          range.insertNode(mark);

          matches.push({
            id: `match-${matchId++}`,
            markElement: mark,
            blockElement: mark.closest("pre") as HTMLElement | null,
            preview: text.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20),
          });

          // 移动到 mark 之后继续
          regex.lastIndex = match.index + match[0].length;
          break; // 每个文本节点只取第一个匹配，避免 DOM 操作冲突
        }
      }

      setDomMatches(matches);
      setIsSearching(false);
    }, 200);

    return () => {
      if (searchTimerRef.current !== undefined) {
        window.clearTimeout(searchTimerRef.current);
      }
    };
  }, [query, enabled, containerRef, messagesSignal, searchOptions, ensureRevealed, isRegexInvalid]);

  // 合并匹配结果
  const matches = useMemo(() => {
    if (containerRef?.current) {
      return domMatches;
    }
    return messageMatches.map((_msgIdx, i) => ({
      id: `msg-${i}`,
      markElement: null,
      blockElement: null,
      preview: undefined,
    }));
  }, [domMatches, messageMatches, containerRef]);

  const totalMatches = matches.length;

  const next = useCallback(() => {
    if (totalMatches === 0) return;
    setCurrentIndex((prev) => (prev + 1) % totalMatches);
  }, [totalMatches]);

  const previous = useCallback(() => {
    if (totalMatches === 0) return;
    setCurrentIndex((prev) => (prev - 1 + totalMatches) % totalMatches);
  }, [totalMatches]);

  const goToIndex = useCallback((idx: number) => {
    if (idx >= 0 && idx < totalMatches) setCurrentIndex(idx);
  }, [totalMatches]);

  // 兼容旧 API
  const goToNext = next;
  const goToPrev = previous;

  const clear = useCallback(() => {
    setQuery("");
    setCurrentIndex(0);
    setDomMatches([]);
    setExpandedCount(0);
    // 清除 DOM 中的 <mark>
    const container = containerRef?.current;
    if (container) {
      container.querySelectorAll("mark.cc-search-mark").forEach((m) => {
        const parent = m.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(m.textContent || ""), m);
          parent.normalize();
        }
      });
    }
  }, [containerRef]);

  // query 变化时重置 index
  useEffect(() => {
    setCurrentIndex(0);
  }, [query]);

  // 滚动到当前匹配
  useEffect(() => {
    if (currentIndex < 0 || currentIndex >= matches.length) return;
    const match = matches[currentIndex];
    if (match?.markElement) {
      match.markElement.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (match?.blockElement) {
      match.blockElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentIndex, matches]);

  return {
    query, setQuery,
    matches,
    currentIndex,
    next, previous, goToIndex,
    isSearching,
    expandedCount,
    isRegexInvalid,
    clear,
    // 旧 API 兼容
    useRegex, setUseRegex,
    caseSensitive, setCaseSensitive,
    goToNext, goToPrev,
    totalMatches,
  };
}
