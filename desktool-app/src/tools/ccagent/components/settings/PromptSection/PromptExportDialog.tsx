// PromptSection/PromptExportDialog.tsx — Prompt 导出弹窗
// 对齐 cc-gui 的 PromptSection/PromptExportDialog.tsx
// 选择要导出的 Prompt 模板，确认后导出为 JSON 文件

import { useState, useEffect, useMemo } from "react";
import type { PromptTemplate } from "../../../types";
import { CloseIcon } from "../../Icons";
import { uid } from "../../../constants";

interface PromptExportDialogProps {
  isOpen: boolean;
  prompts: PromptTemplate[];
  onConfirm: (selectedIds: string[]) => void;
  onCancel: () => void;
}

export default function PromptExportDialog({
  isOpen,
  prompts,
  onConfirm,
  onCancel,
}: PromptExportDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 打开时默认全选
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(prompts.map(p => p.id)));
    }
  }, [isOpen, prompts]);

  // Esc 关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onCancel]);

  const allSelected = useMemo(
    () => prompts.length > 0 && selectedIds.size === prompts.length,
    [prompts, selectedIds],
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(prompts.map(p => p.id)));
    }
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds));
  };

  const handleExportToFile = () => {
    const selected = prompts.filter(p => selectedIds.has(p.id));
    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      prompts: selected.map(p => ({
        id: uid(),
        name: p.name,
        content: p.content,
        modified: p.modified || Date.now(),
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prompts-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="cc-dialog-overlay">
      <div className="cc-dialog" style={{ minWidth: "520px" }}>
        <div className="cc-dialog-header">
          <h3>导出 Prompt 模板</h3>
          <button className="cc-close-btn" onClick={onCancel}><CloseIcon size={16} /></button>
        </div>

        <div className="cc-dialog-body">
          <p className="cc-dialog-desc">
            选择要导出的 Prompt 模板（已选 {selectedIds.size} / {prompts.length}）
          </p>

          <div style={{ marginBottom: "10px" }}>
            <label className="cc-toggle-switch" style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              <span style={{ fontSize: "12px" }}>全选/取消全选</span>
            </label>
          </div>

          <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid var(--border, #444)", borderRadius: "4px" }}>
            {prompts.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted, #888)", fontSize: "12px" }}>
                暂无可导出的 Prompt 模板
              </div>
            ) : (
              prompts.map(prompt => (
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
                    <div style={{ fontSize: "12px", color: "var(--text, #eee)" }}>{prompt.name}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted, #888)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {prompt.content.slice(0, 60) || "(空内容)"}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="cc-dialog-footer">
          <div className="cc-footer-actions" style={{ marginLeft: "auto" }}>
            <button className="cc-btn cc-btn-secondary" onClick={onCancel}>
              <CloseIcon size={14} />
              取消
            </button>
            <button className="cc-btn cc-btn-secondary" onClick={handleExportToFile} disabled={selectedIds.size === 0}>
              下载文件
            </button>
            <button className="cc-btn cc-btn-primary" onClick={handleConfirm} disabled={selectedIds.size === 0}>
              导出选中
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
