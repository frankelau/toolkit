// SessionTabBar — ccgui 风格会话标签栏
// 替代旧的 workspace tabs + top bar，提供更简洁的会话管理

import { useState, useRef, useCallback } from "react";
import type { Engine, WorkspaceTab } from "../types";

interface SessionTabBarProps {
  workspaces: WorkspaceTab[];
  activeId: string;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  // 引擎 & 设置
  engine: Engine;
  onEngineChange: (e: Engine) => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenGit: () => void;
  // 状态
  streaming: boolean;
  onNewSession: () => void;
  model: string;
}

export function SessionTabBar({
  workspaces, activeId, onSwitch, onAdd, onRemove, onRename,
  engine, onEngineChange, onOpenSettings, onOpenHistory, onOpenGit,
  streaming, onNewSession, model,
}: SessionTabBarProps) {
  return (
    <div className="cc-session-tabbar">
      {/* 左侧：会话 Tabs */}
      <div className="cc-st-tabs">
        {workspaces.map(w => (
          <SessionTab
            key={w.id}
            workspace={w}
            isActive={w.id === activeId}
            hasSession={!!w.sessionId}
            onSwitch={() => onSwitch(w.id)}
            onRemove={(e) => { e.stopPropagation(); onRemove(w.id); }}
            onRename={(name) => onRename(w.id, name)}
          />
        ))}
        <button className="cc-st-add-btn" onClick={onAdd} title="新建会话">+</button>
      </div>

      {/* 右侧：操作区 */}
      <div className="cc-st-actions">
        {/* 模型/引擎 */}
        <div className="cc-st-engine-group">
          {(["claude", "codex"] as Engine[]).map(e => (
            <button
              key={e}
              className={`cc-st-engine-btn ${engine === e ? "active" : ""}`}
              onClick={() => onEngineChange(e)}
              title={e === "claude" ? "Claude Code" : "Codex CLI"}
            >
              {e === "claude" ? "🧠" : "⚡"}
            </button>
          ))}
          <span className="cc-st-model-badge" title={model}>
            {model ? model.replace("[1m]", "") : (engine === "claude" ? "Sonnet" : "GPT-5")}
          </span>
        </div>

        {/* 流式指示 */}
        {streaming && <span className="cc-st-streaming-dot" title="输出中">●</span>}

        {/* 功能按钮 */}
        <button className="cc-st-action-btn" onClick={onOpenGit} title="Git 管理">🌿</button>
        <button className="cc-st-action-btn" onClick={onOpenHistory} title="会话历史">📜</button>
        <button className="cc-st-action-btn" onClick={onOpenSettings} title="设置">⚙️</button>
        <button className="cc-st-action-btn cc-st-new-session" onClick={onNewSession} disabled={streaming} title="新建会话">
          +
        </button>
      </div>
    </div>
  );
}

// ── 单个 Tab ───────────────────────────────────────────────────────────────

function SessionTab({
  workspace, isActive, hasSession,
  onSwitch, onRemove, onRename,
}: {
  workspace: WorkspaceTab;
  isActive: boolean;
  hasSession: boolean;
  onSwitch: () => void;
  onRemove: (e: React.MouseEvent) => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(workspace.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(workspace.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 50);
  }, [workspace.name]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    const trimmed = editName.trim();
    if (trimmed && trimmed !== workspace.name) {
      onRename(trimmed);
    }
  }, [editName, workspace.name, onRename]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditName(workspace.name);
  }, [workspace.name]);

  return (
    <div
      className={`cc-st-tab ${isActive ? "active" : ""}`}
      onClick={onSwitch}
      title={workspace.cwd}
    >
      <span className="cc-st-tab-icon">📁</span>

      {editing ? (
        <input
          ref={inputRef}
          className="cc-st-tab-edit"
          value={editName}
          onChange={e => setEditName(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") cancelEdit();
          }}
          onClick={e => e.stopPropagation()}
          maxLength={50}
        />
      ) : (
        <span className="cc-st-tab-name" onDoubleClick={startEdit}>
          {workspace.name}
        </span>
      )}

      {hasSession && !editing && <span className="cc-st-tab-dot" />}

      <span
        className="cc-st-tab-close"
        onClick={onRemove}
        title="关闭"
      >×</span>
    </div>
  );
}

export default SessionTabBar;
