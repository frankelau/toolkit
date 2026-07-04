// HistoryView — 完整历史浏览视图
// 对齐 cc-gui components/history/HistoryView.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClaudeSession } from "../../types";
import { HistoryActions } from "./HistoryActions";
import { VirtualList } from "../common/VirtualList";

const DEEP_SEARCH_TIMEOUT_MS = 30_000;

export interface HistoryViewProps {
  sessions: ClaudeSession[];
  currentSessionId?: string | null;
  onLoadSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onDeleteSessions: (sessionIds: string[]) => void;
  onExportSession: (sessionId: string, title: string) => void;
  onToggleFavorite: (sessionId: string) => void;
  onUpdateTitle: (sessionId: string, newTitle: string) => void;
  onConvertToCliSession?: (sessionId: string) => void;
  favorites?: Set<string>;
  customTitles?: Record<string, string>;
}

function getTs(ts?: number): number { return (ts && new Date(ts).getTime()) || 0; }

function getTitle(s: ClaudeSession, ct?: Record<string, string>): string {
  return ct?.[s.session_id] || s.summary || s.project?.split("/").pop() || "未命名会话";
}

export function HistoryView({
  sessions, currentSessionId,
  onLoadSession, onDeleteSession, onExportSession,
  onToggleFavorite, onUpdateTitle, onConvertToCliSession,
  favorites = new Set(), customTitles = {},
}: HistoryViewProps) {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeepSearching, setIsDeepSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((v: string) => {
    setSearchInput(v);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setSearchQuery(v.trim()), 300);
  }, []);

  useEffect(() => {
    if (!searchQuery) { setIsDeepSearching(false); return; }
    setIsDeepSearching(true);
    if (deepTimerRef.current) clearTimeout(deepTimerRef.current);
    deepTimerRef.current = setTimeout(() => setIsDeepSearching(false), DEEP_SEARCH_TIMEOUT_MS);
    return () => { if (deepTimerRef.current) clearTimeout(deepTimerRef.current); };
  }, [searchQuery]);

  const filtered = useMemo(() => {
    let r = sessions;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      r = r.filter(s =>
        getTitle(s, customTitles).toLowerCase().includes(q) ||
        (s.project || "").toLowerCase().includes(q) ||
        s.session_id.toLowerCase().includes(q)
      );
    }
    return [...r].sort((a, b) => {
      const af = favorites.has(a.session_id) ? 0 : 1;
      const bf = favorites.has(b.session_id) ? 0 : 1;
      return af !== bf ? af - bf : getTs(b.modified) - getTs(a.modified);
    });
  }, [sessions, searchQuery, favorites, customTitles]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const renderItem = useCallback((s: ClaudeSession) => {
    const id = s.session_id;
    const title = getTitle(s, customTitles);
    const isFav = favorites.has(id);
    const isCurr = currentSessionId === id;
    const isSel = selectedIds.has(id);

    return (
      <div className={`cc-history-row ${isCurr ? "cc-history-current" : ""}`}>
        <label className="cc-history-check">
          <input type="checkbox" checked={isSel} onChange={() => toggleSelect(id)} onClick={e => e.stopPropagation()} />
        </label>
        <div className="cc-history-main" onClick={() => onLoadSession(id)}>
          {editingId === id ? (
            <input className="cc-history-edit-input" value={editingTitle} onChange={e => setEditingTitle(e.target.value)}
              onBlur={() => { onUpdateTitle(id, editingTitle); setEditingId(null); }}
              onKeyDown={e => { if (e.key === "Enter") { onUpdateTitle(id, editingTitle); setEditingId(null); } if (e.key === "Escape") setEditingId(null); }}
              autoFocus onClick={e => e.stopPropagation()} />
          ) : (
            <div className="cc-history-title" title={title}>
              {isFav && <span className="cc-history-fav">⭐</span>}
              {isCurr && <span className="cc-history-badge">当前</span>}
              {title}
            </div>
          )}
          <div className="cc-history-meta">
            {s.project && <span>{s.project.replace(/^-Users-/, "~/").replace(/-/g, "/")}</span>}
          </div>
        </div>
        <div className="cc-history-actions">
          <button onClick={e => { e.stopPropagation(); setEditingId(id); setEditingTitle(title); }} title="重命名">✏️</button>
          <button onClick={e => { e.stopPropagation(); onToggleFavorite(id); }} title={isFav ? "取消收藏" : "收藏"}>{isFav ? "★" : "☆"}</button>
          <button onClick={e => { e.stopPropagation(); onExportSession(id, title); }} title="导出">📤</button>
          {onConvertToCliSession && !isCurr && <button onClick={e => { e.stopPropagation(); onConvertToCliSession(id); }} title="转CLI">🔄</button>}
          <button className="cc-history-delete" onClick={e => { e.stopPropagation(); onDeleteSession(id); }} title="删除">🗑️</button>
        </div>
      </div>
    );
  }, [selectedIds, favorites, customTitles, editingId, editingTitle, currentSessionId, toggleSelect, onLoadSession, onUpdateTitle, onToggleFavorite, onExportSession, onDeleteSession, onConvertToCliSession]);

  if (sessions.length === 0) {
    return <div className="cc-history-empty"><div className="cc-history-empty-icon">📜</div><div>暂无历史会话</div><div className="cc-history-empty-hint">开始新对话后会自动记录</div></div>;
  }

  return (
    <div className="cc-history-view">
      <div className="cc-history-toolbar">
        <div className="cc-history-search-wrap">
          <input className="cc-history-search" value={searchInput} onChange={e => handleSearch(e.target.value)} placeholder="搜索会话…" />
          {isDeepSearching && <span className="cc-history-deep">深搜中…</span>}
        </div>
        <HistoryActions total={filtered.length} selected={selectedIds.size} onRefresh={() => {}} onClearAll={() => setSelectedIds(new Set())} onExportAll={() => {}} loading={false} />
      </div>
      <div className="cc-history-stats">
        <span>{filtered.length} 个会话</span>
        {searchQuery && filtered.length < sessions.length && <span>（共 {sessions.length}）</span>}
      </div>
      {searchQuery && filtered.length === 0 ? (
        <div className="cc-history-empty"><div>未找到匹配 "{searchQuery}" 的会话</div></div>
      ) : (
        <div className="cc-history-list-wrap">
          <VirtualList items={filtered} itemHeight={56} maxHeight={600} renderItem={renderItem} keyExtractor={(s: ClaudeSession) => s.session_id} />
        </div>
      )}
    </div>
  );
}

export default HistoryView;
