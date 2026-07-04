// Agent 创建/管理 — 需求文档明确点名："创建agent"
// 对齐 cc-gui 的 settings/AgentSection

import { useState } from "react";
import type { AgentConfig } from "../types";
import { uid } from "../constants";

interface AgentSectionProps {
  agents: AgentConfig[];
  onAdd: (agent: AgentConfig) => void;
  onUpdate: (agent: AgentConfig) => void;
  onDelete: (id: string) => void;
  onUse: (agent: AgentConfig) => void;
}

export function AgentSection({ agents, onAdd, onUpdate, onDelete, onUse }: AgentSectionProps) {
  const [editing, setEditing] = useState<AgentConfig | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  function startCreate() {
    setEditing({ id: uid(), name: "", prompt: "", createdAt: Date.now() });
    setShowEditor(true);
  }

  function startEdit(agent: AgentConfig) {
    setEditing({ ...agent });
    setShowEditor(true);
  }

  function save() {
    if (!editing || !editing.name.trim()) return;
    const exists = agents.some(a => a.id === editing.id);
    if (exists) {
      onUpdate(editing);
    } else {
      onAdd(editing);
    }
    setShowEditor(false);
    setEditing(null);
  }

  function cancel() {
    setShowEditor(false);
    setEditing(null);
  }

  return (
    <div className="cc-agent-section">
      <div className="cc-section-head">
        <span className="cc-section-title">🤖 Agent 管理</span>
        <button className="cc-section-add" onClick={startCreate}>+ 新建</button>
      </div>
      <div className="cc-section-desc">创建可复用的 Agent（名称 + Prompt），在输入框用 @agent 调用</div>

      {agents.length === 0 && !showEditor && (
        <div className="cc-agent-empty">暂无 Agent，点击「新建」创建</div>
      )}

      <div className="cc-agent-list">
        {agents.map(a => (
          <div key={a.id} className="cc-agent-item">
            <div className="cc-agent-item-info">
              <div className="cc-agent-item-name">{a.name}</div>
              <div className="cc-agent-item-prompt">{(a.prompt || "").slice(0, 60)}{a.prompt && a.prompt.length > 60 ? "…" : ""}</div>
            </div>
            <div className="cc-agent-item-actions">
              <button className="cc-agent-use" onClick={() => onUse(a)} title="使用此 Agent">使用</button>
              <button className="cc-agent-edit" onClick={() => startEdit(a)} title="编辑">✏️</button>
              <button className="cc-agent-del" onClick={() => { if (confirm(`删除 Agent「${a.name}」？`)) onDelete(a.id); }} title="删除">🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {showEditor && editing && (
        <div className="cc-agent-editor-overlay" onClick={cancel}>
          <div className="cc-agent-editor" onClick={e => e.stopPropagation()}>
            <div className="cc-agent-editor-title">{agents.some(a => a.id === editing.id) ? "编辑 Agent" : "新建 Agent"}</div>
            <label className="cc-agent-field-label">名称（最长 20 字符）</label>
            <input
              className="cc-agent-field-input"
              value={editing.name}
              maxLength={20}
              placeholder="如：代码审查员"
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              autoFocus
            />
            <label className="cc-agent-field-label">Prompt（最长 100000 字符）</label>
            <textarea
              className="cc-agent-field-textarea"
              value={editing.prompt || ""}
              maxLength={100000}
              placeholder="你是一个专业的代码审查员，请对用户提交的代码进行审查..."
              rows={10}
              onChange={e => setEditing({ ...editing, prompt: e.target.value })}
            />
            <div className="cc-agent-editor-actions">
              <button className="cc-agent-cancel" onClick={cancel}>取消</button>
              <button className="cc-agent-save" onClick={save} disabled={!editing.name.trim()}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
