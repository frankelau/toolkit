// FileChangesList.tsx — 文件变更列表子组件
// 对齐 cc-gui StatusPanel/FileChangesList.tsx
// 增强：新增 Diff 查看按钮，点击展开 DiffViewer 对比代码差异

import { useState } from "react";
import type { FileChangesListProps } from "./types";
import { computeFileStats } from "./utils";
import type { FileChangeSummary } from "../../types";
import DiffViewer from "../DiffViewer";

export function FileChangesList({ fileChanges, onClear, onUndoFile, onDiscardAll }: FileChangesListProps) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [undoTarget, setUndoTarget] = useState<FileChangeSummary | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [diffTarget, setDiffTarget] = useState<string | null>(null);

  if (fileChanges.length === 0) return <div className="cc-panel-empty">暂无文件变更</div>;

  const { totalAdds, totalDels } = computeFileStats(fileChanges);

  function handleUndo(f: FileChangeSummary) { setUndoTarget(f); }
  function confirmUndo() {
    if (undoTarget && onUndoFile) onUndoFile(undoTarget.filePath);
    setUndoTarget(null);
  }
  function handleDiscardAll() {
    if (onDiscardAll) onDiscardAll();
    setConfirmDiscard(false);
  }
  function toggleDiff(filePath: string) {
    setDiffTarget((d) => (d === filePath ? null : filePath));
  }

  /** 将多个操作的 oldString / newString 拼接为完整 diff 文本 */
  function buildDiffText(fc: FileChangeSummary) {
    const oldParts: string[] = [];
    const newParts: string[] = [];
    for (const op of fc.operations) {
      if (op.oldString) oldParts.push(op.oldString);
      if (op.newString) newParts.push(op.newString);
    }
    return { oldText: oldParts.join("\n"), newText: newParts.join("\n") };
  }

  return (
    <div className="cc-panel-list">
      <div className="cc-files-actions">
        <span className="cc-files-summary">
          {fileChanges.length} 文件 · <span className="cc-stat-add">+{totalAdds}</span>{" "}
          <span className="cc-stat-del">-{totalDels}</span>
        </span>
        <div className="cc-files-btns">
          {onDiscardAll && (
            <button className="cc-files-discard" onClick={() => setConfirmDiscard(true)} title="撤销所有文件变更">
              全部撤销
            </button>
          )}
          <button className="cc-files-clear" onClick={onClear} title="清除记录">清除</button>
        </div>
      </div>

      {fileChanges.map((f) => (
        <div key={f.filePath} className="cc-file-change-item">
          <div className="cc-file-change-row" onClick={() => setExpanded(e => e === f.filePath ? null : f.filePath)}>
            <span className={`cc-file-status ${f.status === "A" ? "cc-file-added" : "cc-file-modified"}`}>{f.status}</span>
            <span className="cc-file-name" title={f.filePath}>{f.fileName}</span>
            <span className="cc-file-stats">
              {f.additions > 0 && <span className="cc-stat-add">+{f.additions}</span>}
              {f.deletions > 0 && <span className="cc-stat-del">-{f.deletions}</span>}
            </span>
            <div className="cc-file-actions" onClick={(e) => e.stopPropagation()}>
              {f.operations.length > 0 && (
                <button
                  className={`cc-file-diff-btn ${diffTarget === f.filePath ? "cc-file-diff-active" : ""}`}
                  onClick={() => toggleDiff(f.filePath)}
                  title="查看差异对比"
                >
                  ⇄ Diff
                </button>
              )}
            </div>
            <span className="cc-file-chevron">{expanded === f.filePath ? "▼" : "▶"}</span>
          </div>

          {/* Diff 查看器 */}
          {diffTarget === f.filePath && f.operations.length > 0 && (
            <div className="cc-file-diff-view" onClick={(e) => e.stopPropagation()}>
              {(() => {
                const { oldText, newText } = buildDiffText(f);
                return (
                  <DiffViewer
                    oldText={oldText || "(空)"}
                    newText={newText || "(空)"}
                    fileName={f.fileName}
                  />
                );
              })()}
            </div>
          )}

          {expanded === f.filePath && (
            <div className="cc-file-ops-detail">
              <div className="cc-file-ops-path" title={f.filePath}>{f.filePath}</div>
              <div className="cc-file-ops-list">
                {f.operations.map((op, i) => (
                  <div key={i} className="cc-file-op">
                    <span className="cc-file-op-name">{op.toolName}</span>
                    <span className="cc-file-op-stats">
                      <span className="cc-stat-add">+{op.additions}</span>
                      <span className="cc-stat-del">-{op.deletions}</span>
                    </span>
                  </div>
                ))}
              </div>
              {onUndoFile && (
                <button className="cc-file-undo-btn" onClick={(e) => { e.stopPropagation(); handleUndo(f); }}>
                  ↶ 撤销此文件变更
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {confirmDiscard && (
        <div className="cc-confirm-overlay" onClick={() => setConfirmDiscard(false)}>
          <div className="cc-confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className="cc-confirm-title">⚠️ 全部撤销</div>
            <div className="cc-confirm-msg">
              将撤销 {fileChanges.length} 个文件的所有变更，此操作不可恢复。确定继续吗？
            </div>
            <div className="cc-confirm-actions">
              <button className="cc-confirm-cancel" onClick={() => setConfirmDiscard(false)}>取消</button>
              <button className="cc-confirm-ok" onClick={handleDiscardAll}>确认撤销</button>
            </div>
          </div>
        </div>
      )}

      {undoTarget && (
        <div className="cc-confirm-overlay" onClick={() => setUndoTarget(null)}>
          <div className="cc-confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className="cc-confirm-title">↶ 撤销文件变更</div>
            <div className="cc-confirm-msg">
              将撤销 <code>{undoTarget.fileName}</code> 的 {undoTarget.operations.length} 次编辑操作。确定继续吗？
            </div>
            <div className="cc-confirm-actions">
              <button className="cc-confirm-cancel" onClick={() => setUndoTarget(null)}>取消</button>
              <button className="cc-confirm-ok" onClick={confirmUndo}>确认撤销</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FileChangesList;
