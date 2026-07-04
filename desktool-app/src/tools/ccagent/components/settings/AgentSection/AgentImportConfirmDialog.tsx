// AgentImportConfirmDialog.tsx — Agent 导入确认对话框
// 对齐 cc-gui AgentSection/AgentImportConfirmDialog.tsx
// 适配：中文内联替代 i18n

import { useState } from "react";
import { createPortal } from "react-dom";
import type { AgentConfig } from "../../../types";

export interface AgentImportPreview {
  agent: AgentConfig;
  action: "create" | "overwrite" | "skip";
  existingName?: string;
}

export interface AgentImportConfirmDialogProps {
  previews: AgentImportPreview[];
  onConfirm: (selectedAgents: AgentConfig[]) => void;
  onCancel: () => void;
  sourceName?: string;
}

const ACTION_LABEL: Record<AgentImportPreview["action"], string> = {
  create: "新建",
  overwrite: "覆盖",
  skip: "跳过",
};

const ACTION_CLASS: Record<AgentImportPreview["action"], string> = {
  create: "cc-import-action-create",
  overwrite: "cc-import-action-overwrite",
  skip: "cc-import-action-skip",
};

export default function AgentImportConfirmDialog({
  previews, onConfirm, onCancel, sourceName = "剪贴板",
}: AgentImportConfirmDialogProps) {
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const activePreviews = previews.filter(p => p.action !== "skip" && !deselected.has(p.agent.id));

  const toggleItem = (id: string) => {
    const next = new Set(deselected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDeselected(next);
  };

  const handleConfirm = () => {
    onConfirm(activePreviews.map(p => p.agent));
  };

  const createCount = previews.filter(p => p.action === "create").length;
  const overwriteCount = previews.filter(p => p.action === "overwrite").length;
  const skipCount = previews.filter(p => p.action === "skip").length;

  return createPortal(
    <div className="cc-agent-import-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="cc-agent-import-dialog">
        <div className="cc-dialog-header">
          <h3>确认导入 Agent 配置</h3>
          <button className="cc-close-btn" onClick={onCancel}>✕</button>
        </div>

        <div className="cc-dialog-content">
          <p className="cc-dialog-desc">来源：{sourceName}</p>

          <div className="cc-import-summary">
            <span className="cc-import-summary-create">新建 {createCount}</span>
            <span className="cc-import-summary-overwrite">覆盖 {overwriteCount}</span>
            <span className="cc-import-summary-skip">跳过 {skipCount}</span>
          </div>

          <div className="cc-import-list">
            {previews.map((preview) => {
              const isSkipped = preview.action === "skip";
              const isDeselected = deselected.has(preview.agent.id);
              const disabled = isSkipped;
              return (
                <div
                  key={preview.agent.id}
                  className={`cc-import-item ${disabled ? "cc-import-item-disabled" : ""}`}
                  onClick={() => !disabled && toggleItem(preview.agent.id)}
                >
                  <input
                    type="checkbox"
                    checked={!isSkipped && !isDeselected}
                    disabled={isSkipped}
                    readOnly
                  />
                  <div className="cc-import-item-info">
                    <span className="cc-import-item-name">{preview.agent.name}</span>
                    {preview.action === "overwrite" && preview.existingName && (
                      <span className="cc-import-item-existing">将覆盖：{preview.existingName}</span>
                    )}
                  </div>
                  <span className={`cc-import-action ${ACTION_CLASS[preview.action]}`}>
                    {ACTION_LABEL[preview.action]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="cc-dialog-footer">
          <button className="cc-btn-secondary" onClick={onCancel}>取消</button>
          <button className="cc-btn-primary" onClick={handleConfirm} disabled={activePreviews.length === 0}>
            导入 {activePreviews.length > 0 ? `(${activePreviews.length})` : ""}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
