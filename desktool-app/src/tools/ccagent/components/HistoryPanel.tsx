// 历史会话面板组件 — Phase 7

import { useLocale } from "../hooks/useLocale";
import { useState, useMemo, useEffect, useRef } from "react";
import { toast, copyText } from "../../../useCopyFeedback";
import { saveTextWithDialog } from "../../../saveFile";
import type { ClaudeSession } from "../types";

export interface HistoryPanelProps {
  sessions: ClaudeSession[];
  loading: boolean;
  onRefresh: () => void;
  onResume: (sessionId: string) => void;
}

export function HistoryPanel({ sessions, loading, onRefresh, onResume }: HistoryPanelProps) {
  const { t } = useLocale();
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("ccagent:historyFavs");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [customTitles, setCustomTitles] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem("ccagent:historyTitles");
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const listRef = useRef<HTMLDivElement>(null);

  // 持久化收藏和自定义标题
  useEffect(() => {
    localStorage.setItem("ccagent:historyFavs", JSON.stringify([...favorites]));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem("ccagent:historyTitles", JSON.stringify(customTitles));
  }, [customTitles]);

  // 项目列表（去重）
  const projects = useMemo(() => {
    const set = new Set(sessions.map(s => s.project));
    return [...set].sort();
  }, [sessions]);

  // 过滤
  const filtered = useMemo(() => {
    let result = sessions;
    if (projectFilter) {
      result = result.filter(s => s.project === projectFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        (s.summary || "").toLowerCase().includes(q) ||
        s.session_id.toLowerCase().includes(q) ||
        s.project.toLowerCase().includes(q)
      );
    }
    // 收藏的排前面
    return [...result].sort((a, b) => {
      const af = favorites.has(a.session_id) ? 0 : 1;
      const bf = favorites.has(b.session_id) ? 0 : 1;
      if (af !== bf) return af - bf;
      return (b.modified ?? 0) - (a.modified ?? 0);
    });
  }, [sessions, searchQuery, projectFilter, favorites]);

  function toggleFavorite(sessionId: string) {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }

  function startEdit(session: ClaudeSession) {
    setEditingId(session.session_id);
    setEditTitle(customTitles[session.session_id] || session.summary || "");
  }

  function saveEdit(sessionId: string) {
    setCustomTitles(prev => ({ ...prev, [sessionId]: editTitle.trim() }));
    setEditingId(null);
    toast("标题已保存", "success");
  }

  async function exportSession(session: ClaudeSession) {
    const title = customTitles[session.session_id] || session.summary || session.session_id;
    const data = {
      session_id: session.session_id,
      project: session.project,
      summary: title,
      modified: session.modified ? new Date(session.modified * 1000).toISOString() : null,
    };
    const json = JSON.stringify(data, null, 2);
    await saveTextWithDialog(json, `session-${session.session_id.slice(0, 8)}.json`);
  }

  function copySessionId(session: ClaudeSession) {
    copyText(session.session_id, `会话 ID 已复制: ${session.session_id.slice(0, 8)}…`);
  }

  function formatProjectPath(project: string): string {
    return project.replace(/^-Users-/, "~/").replace(/-/g, "/");
  }

  function formatTime(modified?: number): string {
    if (!modified) return "";
    const date = new Date(modified * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "今天 " + date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    if (days === 1) return "昨天";
    if (days < 7) return `${days} 天前`;
    if (days < 30) return `${Math.floor(days / 7)} 周前`;
    return date.toLocaleDateString("zh-CN");
  }

  return (
    <div className="cc-history">
      {/* 头部工具栏 */}
      <div className="cc-history-head">
        <span className="cc-history-title">📜 会话历史 ({sessions.length})</span>
        <button className="cc-history-refresh" onClick={onRefresh} disabled={loading}>
          {loading ? "加载中…" : "🔄 刷新"}
        </button>
      </div>

      {/* 搜索和过滤 */}
      {sessions.length > 0 && (
        <div className="cc-history-filters">
          <input
            className="cc-history-search"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t("historyPanel.historyPanel.k11")}
            spellCheck={false}
          />
          <select
            className="cc-history-project-filter"
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
          >
            <option value="">{t("historyPanel.historyPanel.k1")}</option>
            {projects.map(p => (
              <option key={p} value={p}>{formatProjectPath(p)}</option>
            ))}
          </select>
        </div>
      )}

      {/* 会话列表 */}
      {loading ? (
        <div className="cc-history-empty">{t("historyPanel.historyPanel.k2")}</div>
      ) : filtered.length === 0 ? (
        sessions.length === 0 ? (
          <div className="cc-history-empty">{t("historyPanel.historyPanel.k3")}</div>
        ) : (
          <div className="cc-history-empty">{t("historyPanel.historyPanel.k4")}</div>
        )
      ) : (
        <div className="cc-history-list" ref={listRef}>
          {filtered.map(s => {
            const isFav = favorites.has(s.session_id);
            const title = customTitles[s.session_id] || s.summary || "(无摘要)";
            const isEditing = editingId === s.session_id;

            return (
              <div key={s.session_id} className={`cc-history-item ${isFav ? "cc-history-fav" : ""}`}>
                <div className="cc-history-item-main">
                  {/* 收藏星标 */}
                  <button
                    className={`cc-history-star ${isFav ? "active" : ""}`}
                    onClick={() => toggleFavorite(s.session_id)}
                    title={isFav ? "取消收藏" : "收藏"}
                  >
                    {isFav ? "⭐" : "☆"}
                  </button>

                  <div className="cc-history-item-info">
                    {/* 标题（可编辑） */}
                    {isEditing ? (
                      <div className="cc-history-edit-row">
                        <input
                          className="cc-history-edit-input"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") saveEdit(s.session_id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                        />
                        <button className="cc-history-edit-save" onClick={() => saveEdit(s.session_id)}>保存</button>
                        <button className="cc-history-edit-cancel" onClick={() => setEditingId(null)}>取消</button>
                      </div>
                    ) : (
                      <div
                        className="cc-history-item-summary"
                        onDoubleClick={() => startEdit(s)}
                        title={t("historyPanel.historyPanel.k7")}
                      >
                        {title}
                      </div>
                    )}

                    {/* 元信息 */}
                    <div className="cc-history-item-meta">
                      <span className="cc-history-item-id" title={s.session_id} onClick={() => copySessionId(s)}>
                        {s.session_id.slice(0, 8)}
                      </span>
                      <span className="cc-history-item-project" title={s.project}>
                        📁 {formatProjectPath(s.project)}
                      </span>
                      {s.modified && (
                        <span className="cc-history-item-time">{formatTime(s.modified)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="cc-history-item-actions">
                  <button
                    className="cc-history-resume"
                    onClick={() => onResume(s.session_id)}
                    title={t("historyPanel.historyPanel.k8")}
                  >
                    恢复
                  </button>
                  <button
                    className="cc-history-action-btn"
                    onClick={() => startEdit(s)}
                    title={t("historyPanel.historyPanel.k9")}
                  >
                    ✏️
                  </button>
                  <button
                    className="cc-history-action-btn"
                    onClick={() => exportSession(s)}
                    title={t("historyPanel.historyPanel.k10")}
                  >
                    📤
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
