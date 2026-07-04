// ConversationSearch/index.tsx — 会话内搜索面板（对齐 cc-gui ConversationSearch）
// Sprint U3: 补齐缺失组件
//
// 行为契约：搜索通过 messagesSignal 驱动（而非流式生命周期事件），
// 确保在实时模式和回放模式下搜索行为一致。

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { t } from "../../i18n";
import { useConversationSearch, DEFAULT_SEARCH_OPTIONS } from "../../hooks/useConversationSearch";
import type { SearchOptions } from "../../hooks/useConversationSearch";
import type { MessageListRevealHandle } from "./types";

// Re-export types for barrel
export type { ConversationSearchMatch, MessageListRevealHandle } from "./types";

const STORAGE_KEY = "ccagent.search.options";

function loadStoredOptions(): SearchOptions {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULT_SEARCH_OPTIONS };
    const parsed = JSON.parse(raw) as Partial<SearchOptions>;
    return {
      matchCase: !!parsed.matchCase,
      wholeWord: !!parsed.wholeWord,
      regex: !!parsed.regex,
    };
  } catch {
    return { ...DEFAULT_SEARCH_OPTIONS };
  }
}

function persistOptions(opts: SearchOptions): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
  } catch {
    // Storage 配额 / 隐私模式 — 静默忽略
  }
}

export interface ConversationSearchProps {
  open: boolean;
  onClose: () => void;
  containerRef: React.RefObject<HTMLElement | null>;
  messagesSignal: string | number;
  messageListRef?: React.RefObject<MessageListRevealHandle | null>;
  isAutoScrollingRef?: React.RefObject<boolean>;
}

export const ConversationSearch = memo(function ConversationSearch({
  open,
  onClose,
  containerRef,
  messagesSignal,
  messageListRef,
  isAutoScrollingRef,
}: ConversationSearchProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [searchOptions, setSearchOptions] = useState<SearchOptions>(loadStoredOptions);

  // 持久化搜索选项
  useEffect(() => {
    persistOptions(searchOptions);
  }, [searchOptions]);

  // 强制展开折叠的早期消息
  const ensureRevealed = useCallback((): number => {
    const handle = messageListRef?.current;
    if (!handle) return 0;
    return handle.revealAll();
  }, [messageListRef]);

  const {
    query, setQuery,
    matches, currentIndex,
    next, previous,
    isSearching, expandedCount,
    isRegexInvalid,
    clear,
  } = useConversationSearch({
    containerRef,
    messagesSignal,
    ensureRevealed,
    enabled: open,
    searchOptions,
  });

  // 打开时自动聚焦
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // 打开时展开折叠消息
  useEffect(() => {
    if (!open) return;
    messageListRef?.current?.revealAll();
  }, [open, messageListRef]);

  // 导航时标记自动滚动
  useEffect(() => {
    if (!open || currentIndex < 0) return;
    if (isAutoScrollingRef) isAutoScrollingRef.current = true;
  }, [currentIndex, open, isAutoScrollingRef]);

  const handleClose = useCallback(() => {
    clear();
    onClose();
  }, [clear, onClose]);

  const toggleMatchCase = useCallback(() => {
    setSearchOptions((o) => ({ ...o, matchCase: !o.matchCase }));
  }, []);
  const toggleWholeWord = useCallback(() => {
    setSearchOptions((o) => ({ ...o, wholeWord: !o.wholeWord }));
  }, []);
  const toggleRegex = useCallback(() => {
    setSearchOptions((o) => ({ ...o, regex: !o.regex }));
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;

    // Alt+C / Alt+W / Alt+R — 切换开关（对齐 VS Code 快捷键）
    if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      const k = e.key.toLowerCase();
      if (k === "c") { e.preventDefault(); e.stopPropagation(); toggleMatchCase(); return; }
      if (k === "w") { e.preventDefault(); e.stopPropagation(); toggleWholeWord(); return; }
      if (k === "r") { e.preventDefault(); e.stopPropagation(); toggleRegex(); return; }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) previous();
      else next();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
      return;
    }
    if (e.key === "F3") {
      e.preventDefault();
      if (e.shiftKey) previous();
      else next();
      return;
    }
  }, [next, previous, handleClose, toggleMatchCase, toggleWholeWord, toggleRegex]);

  const counterText = useMemo(() => {
    if (!query.trim()) return "";
    if (isRegexInvalid) return t("chat.search.invalidRegex");
    if (isSearching) return t("chat.search.searching");
    if (matches.length === 0) return t("chat.search.noResults");
    return t("chat.search.counter", { current: currentIndex + 1, total: matches.length });
  }, [query, isSearching, isRegexInvalid, matches.length, currentIndex]);

  if (!open) return null;

  const hasResults = matches.length > 0;
  const inputError = isRegexInvalid ||
    (query.trim().length > 0 && !isSearching && matches.length === 0);

  const panelStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 8px",
    background: "var(--cc-bg-panel, #333)",
    border: "1px solid var(--cc-border, #555)",
    borderRadius: "6px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    fontSize: "13px",
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: "200px",
    background: "transparent",
    border: "none",
    color: "var(--cc-text-primary, #fff)",
    outline: "none",
    fontSize: "13px",
  };

  const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? "var(--cc-accent, #007acc)" : "transparent",
    border: "none",
    color: "var(--cc-text-secondary, #888)",
    cursor: "pointer",
    padding: "2px 6px",
    borderRadius: "3px",
    fontSize: "11px",
  });

  const navBtnStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    color: "var(--cc-text-secondary, #888)",
    cursor: "pointer",
    padding: "2px 6px",
    borderRadius: "3px",
  };

  return (
    <div
      className="cc-search-panel"
      role="search"
      aria-label={t("chat.search.ariaLabel")}
      style={panelStyle}
      onMouseDown={(e) => {
        if (e.target !== inputRef.current) e.preventDefault();
      }}
    >
      <span style={{ opacity: 0.6 }}>🔍</span>
      <input
        ref={inputRef}
        type="text"
        className={`cc-search-input${inputError ? " is-no-results" : ""}`}
        style={inputStyle}
        placeholder={t("chat.search.placeholder")}
        aria-label={t("chat.search.ariaLabel")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoComplete="off"
      />
      <button
        type="button"
        style={toggleBtnStyle(searchOptions.matchCase)}
        onClick={toggleMatchCase}
        title={t("chat.search.matchCase")}
        aria-pressed={searchOptions.matchCase}
      >
        Aa
      </button>
      <button
        type="button"
        style={toggleBtnStyle(searchOptions.wholeWord)}
        onClick={toggleWholeWord}
        title={t("chat.search.wholeWord")}
        aria-pressed={searchOptions.wholeWord}
      >
        W
      </button>
      <button
        type="button"
        style={toggleBtnStyle(searchOptions.regex)}
        onClick={toggleRegex}
        title={t("chat.search.regex")}
        aria-pressed={searchOptions.regex}
      >
        .*
      </button>
      <span
        className={`cc-search-counter${isRegexInvalid ? " is-error" : ""}`}
        style={{ minWidth: "60px", textAlign: "center", opacity: 0.7 }}
        aria-live="polite"
      >
        {counterText}
      </span>
      <button type="button" style={navBtnStyle} onClick={previous} disabled={!hasResults} title={t("chat.search.previous")}>
        ▲
      </button>
      <button type="button" style={navBtnStyle} onClick={next} disabled={!hasResults} title={t("chat.search.next")}>
        ▼
      </button>
      <button type="button" style={navBtnStyle} onClick={handleClose} title={t("chat.search.close")}>
        ✕
      </button>
      {expandedCount > 0 && (
        <div className="cc-search-hint" role="status" style={{ fontSize: "11px", opacity: 0.6 }}>
          {t("chat.search.expandedHint", { count: expandedCount })}
        </div>
      )}
    </div>
  );
});
