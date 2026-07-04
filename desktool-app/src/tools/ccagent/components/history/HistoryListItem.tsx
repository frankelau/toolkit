// HistoryListItem — 历史会话列表项

import { useState } from "react";
import type { ClaudeSession } from "../../types";

export interface HistoryListItemProps {
  session: ClaudeSession;
  isFavorite: boolean;
  customTitle?: string;
  onToggleFavorite: () => void;
  onResume: () => void;
  onExport: () => void;
  onRename: (newTitle: string) => void;
}

function formatRelativeTime(ts?: number): string {
  if (!ts) return "";
  const now = Date.now();
  const diff = now - ts;
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return "今天";
  if (diff < 2 * day) return "昨天";
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))} 周前`;
  return new Date(ts).toLocaleDateString();
}

function formatProjectPath(project: string): string {
  return project.replace(/^-Users-/, "~/").replace(/-/g, "/");
}

export function HistoryListItem(props: HistoryListItemProps) {
  const { session, isFavorite, customTitle, onToggleFavorite, onResume, onExport, onRename } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(customTitle ?? session.summary);

  const title = customTitle ?? session.summary;
  const shortId = session.session_id.slice(0, 8);

  const commitRename = () => {
    if (draft.trim() && draft !== title) onRename(draft.trim());
    setEditing(false);
  };

  return (
    <div className={`cc-history-row ${isFavorite ? "cc-history-fav" : ""}`}>
      <div className="cc-history-item-main">
        <button
          className={`cc-history-star ${isFavorite ? "active" : ""}`}
          onClick={onToggleFavorite}
          title={isFavorite ? "取消收藏" : "收藏"}
        >
          {isFavorite ? "⭐" : "☆"}
        </button>
        <div className="cc-history-item-info">
          {editing ? (
            <div className="cc-history-edit-row">
              <input
                className="cc-history-edit-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") { setDraft(title); setEditing(false); }
                }}
                autoFocus
              />
              <button className="cc-history-edit-save" onClick={commitRename}>保存</button>
              <button className="cc-history-edit-cancel" onClick={() => { setDraft(title); setEditing(false); }}>取消</button>
            </div>
          ) : (
            <div
              className="cc-history-item-summary"
              onDoubleClick={() => setEditing(true)}
              onClick={onResume}
              title="点击恢复 · 双击编辑标题"
            >
              {title || "(无摘要)"}
            </div>
          )}
          <div className="cc-history-item-meta">
            <span
              className="cc-history-item-id"
              title={session.session_id}
              onClick={() => navigator.clipboard?.writeText(session.session_id)}
            >
              #{shortId}
            </span>
            <span className="cc-history-item-project" title={session.project}>
              {formatProjectPath(session.project)}
            </span>
            <span className="cc-history-item-time">{formatRelativeTime(session.modified)}</span>
          </div>
        </div>
      </div>
      <div className="cc-history-item-actions">
        <button className="cc-history-action-btn" onClick={onResume} title="恢复会话">↩</button>
        <button className="cc-history-action-btn" onClick={onExport} title="导出">⬇</button>
      </div>
    </div>
  );
}
