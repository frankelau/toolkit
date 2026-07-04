// PromptSection/PromptImportConfirmDialog.tsx — Prompt 导入预览确认弹窗
// 对齐 cc-gui 的 PromptSection/PromptImportConfirmDialog.tsx
// 展示导入预览数据，选择冲突策略后确认导入

import { useState, useEffect } from "react";
import type { PromptTemplate } from "../../../types";
import { CloseIcon, WarningIcon, ErrorIcon } from "../../Icons";

export type ConflictStrategy = "skip" | "overwrite" | "rename";

export interface PromptImportPreview {
  prompts: PromptTemplate[];
  conflicts: Array<{ name: string; existing: PromptTemplate; imported: PromptTemplate }>;
}

interface PromptImportConfirmDialogProps {
  isOpen: boolean;
  previewData: PromptImportPreview | null;
  onConfirm: (selectedIds: string[], strategy: ConflictStrategy) => void;
  onCancel: () => void;
}

export default function PromptImportConfirmDialog({
  isOpen,
  previewData,
  onConfirm,
  onCancel,
}: PromptImportConfirmDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [strategy, setStrategy] = useState<ConflictStrategy>("skip");

  useEffect(() => {
    if (isOpen && previewData) {
      setSelectedIds(new Set(previewData.prompts.map(p => p.id)));
      setStrategy("skip");
    }
  }, [isOpen, previewData]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onCancel]);

  if (!isOpen || !previewData) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasConflicts = previewData.conflicts.length > 0;

  return (
    <div className="cc-dialog-overlay">
      <div className="cc-dialog" style={{ minWidth: "560px" }}>
        <div className="cc-dialog-header">
          <h3>导入 Prompt 模板</h3>
          <button className="cc-close-btn" onClick={onCancel}><CloseIcon size={16} /></button>
        </div>

        <div className="cc-dialog-body">
          <p className="cc-dialog-desc">
            预览导入的 {previewData.prompts.length} 个 Prompt 模板
            {hasConflicts && (
              <span style={{ color: "#cca700", marginLeft: "8px" }}>
                （{previewData.conflicts.length} 个命名冲突）
              </span>
            )}
          </p>

          {/* 冲突策略 */}
          {hasConflicts && (
            <div className="cc-form-group">
              <label style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                <WarningIcon size={14} style={{ color: "#cca700" }} />
                <span style={{ fontSize: "12px", fontWeight: 500 }}>冲突处理策略</span>
              </label>
              <select
                className="cc-form-input"
                value={strategy}
                onChange={e => setStrategy(e.target.value as ConflictStrategy)}
                style={{ fontSize: "12px" }}
              >
                <option value="skip">跳过冲突项（保留现有模板）</option>
                <option value="overwrite">覆盖冲突项（替换现有模板）</option>
                <option value="rename">重命名导入项（添加后缀）</option>
              </select>
            </div>
          )}

          {/* 导入列表 */}
          <div style={{ maxHeight: "280px", overflowY: "auto", border: "1px solid var(--border, #444)", borderRadius: "4px" }}>
            {previewData.prompts.map(prompt => {
              const isConflict = previewData.conflicts.some(c => c.imported.id === prompt.id);
              return (
                <label
                  key={prompt.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    borderBottom: "1px solid var(--border, #333)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(prompt.id)}
                    onChange={() => toggleSelect(prompt.id)}
                  />
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: "12px", color: "var(--text, #eee)", display: "flex", alignItems: "center", gap: "6px" }}>
                      {prompt.name}
                      {isConflict && (
                        <span style={{ fontSize: "10px", color: "#cca700", display: "inline-flex", alignItems: "center", gap: "2px" }}>
                          <ErrorIcon size={10} />
                          冲突
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted, #888)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {prompt.content.slice(0, 60) || "(空内容)"}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="cc-dialog-footer">
          <div className="cc-footer-actions" style={{ marginLeft: "auto" }}>
            <button className="cc-btn cc-btn-secondary" onClick={onCancel}>
              <CloseIcon size={14} />
              取消
            </button>
            <button
              className="cc-btn cc-btn-primary"
              onClick={() => onConfirm(Array.from(selectedIds), strategy)}
              disabled={selectedIds.size === 0}
            >
              导入选中（{selectedIds.size}）
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
