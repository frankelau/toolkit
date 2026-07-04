// ConversationSearch — 全局消息搜索（对齐 cc-gui ConversationSearch）
// 简化：基于消息数据搜索而非 DOM 扫描

import { useState, useMemo, useCallback } from "react";
import type { ChatMessage } from "../../types";

interface SearchResult {
  messageIndex: number;
  role: string;
  snippet: string;
  matchStart: number;
}

interface Props {
  isOpen: boolean;
  messages: ChatMessage[];
  onClose: () => void;
  onJumpTo: (messageIndex: number) => void;
}

export function ConversationSearch({ isOpen, messages, onClose, onJumpTo }: Props) {
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState(0);

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    const res: SearchResult[] = [];
    messages.forEach((m, mi) => {
      const text = (m.content || "") + (m.thinking || "");
      const idx = text.toLowerCase().indexOf(q);
      if (idx >= 0) {
        const start = Math.max(0, idx - 30);
        const end = Math.min(text.length, idx + query.length + 30);
        res.push({
          messageIndex: mi,
          role: m.role,
          snippet: (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : ""),
          matchStart: idx - start + (start > 0 ? 1 : 0),
        });
      }
    });
    return res;
  }, [query, messages]);

  const handleJump = useCallback((mi: number) => {
    onJumpTo(mi);
    onClose();
  }, [onJumpTo, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "Enter") {
      if (results.length > 0) handleJump(results[current]?.messageIndex ?? results[0].messageIndex);
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setCurrent(c => Math.min(c + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCurrent(c => Math.max(c - 1, 0)); }
  }, [results, current, onClose, handleJump]);

  if (!isOpen) return null;

  return (
    <div className="cc-search-overlay" onClick={onClose}>
      <div className="cc-search-panel" onClick={e => e.stopPropagation()}>
        <div className="cc-search-input-row">
          <input
            className="cc-search-input"
            placeholder="搜索对话内容…（至少2个字符）"
            value={query}
            onChange={e => { setQuery(e.target.value); setCurrent(0); }}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button className="cc-search-close" onClick={onClose}>✕</button>
        </div>
        {results.length > 0 && (
          <div className="cc-search-stats">
            {current + 1} / {results.length} 条结果
          </div>
        )}
        <div className="cc-search-results">
          {query.length >= 2 && results.length === 0 ? (
            <div className="cc-search-empty">未找到匹配内容</div>
          ) : (
            results.map((r, i) => (
              <div
                key={r.messageIndex + "-" + r.matchStart}
                className={`cc-search-item ${i === current ? "active" : ""}`}
                onClick={() => handleJump(r.messageIndex)}
                onMouseEnter={() => setCurrent(i)}
              >
                <span className="cc-search-role">{r.role === "user" ? "👤" : "🤖"}</span>
                <span className="cc-search-snippet">
                  {r.snippet.slice(0, r.matchStart)}
                  <mark>{r.snippet.slice(r.matchStart, r.matchStart + query.length)}</mark>
                  {r.snippet.slice(r.matchStart + query.length)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
