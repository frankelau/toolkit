// AgentExportDialog.tsx — Agent 导出对话框
// 对齐 cc-gui AgentSection/AgentExportDialog.tsx
// 适配：中文内联替代 i18n，不用 less module

import { useState } from "react";
import { createPortal } from "react-dom";
import type { AgentConfig } from "../../../types";

export interface AgentExportDialogProps {
  agents: AgentConfig[];
  onConfirm: (selectedIds: string[]) => void;
  onCancel: () => void;
}

export default function AgentExportDialog({ agents, onConfirm, onCancel }: AgentExportDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(agents.map(agent => agent.id))
  );

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === agents.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(agents.map(a => a.id)));
  };

  const handleConfirm = () => {
    if (selectedIds.size === 0) return;
    onConfirm(Array.from(selectedIds));
  };

  const allSelected = selectedIds.size === agents.length && agents.length > 0;

  return createPortal(
    <div className="cc-agent-export-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="cc-agent-export-dialog">
        <div className="cc-dialog-header">
          <h3>导出 Agent 配置</h3>
          <button className="cc-close-btn" onClick={onCancel}>✕</button>
        </div>

        <div className="cc-dialog-content">
          <p className="cc-dialog-desc">选择要导出的 Agent 配置（{selectedIds.size}/{agents.length}）：</p>

          <div className="cc-export-list">
            <div className="cc-export-item cc-export-item-all" onClick={toggleAll}>
              <input type="checkbox" checked={allSelected} readOnly />
              <span>{allSelected ? "取消全选" : "全选"}</span>
            </div>
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="cc-export-item"
                onClick={() => toggleSelect(agent.id)}
              >
                <input type="checkbox" checked={selectedIds.has(agent.id)} readOnly />
                <div className="cc-export-item-info">
                  <span className="cc-export-item-name">{agent.name}</span>
                  {agent.prompt && (
                    <span className="cc-export-item-desc">{agent.prompt.slice(0, 60)}{agent.prompt.length > 60 ? "…" : ""}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="cc-dialog-footer">
          <button className="cc-btn-secondary" onClick={onCancel}>取消</button>
          <button className="cc-btn-primary" onClick={handleConfirm} disabled={selectedIds.size === 0}>
            导出 {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
