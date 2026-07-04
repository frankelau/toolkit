// HistoryItemEditor.tsx — 历史记录项编辑器
// 对齐 cc-gui OtherSettingsSection/HistoryItemEditor.tsx
// 用于编辑输入历史记录的单个条目

import { useState, useEffect, useRef } from "react";

export interface HistoryItemEditorProps {
  /** 当前值 */
  value: string;
  /** 保存回调 */
  onSave: (value: string) => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 删除回调 */
  onDelete?: () => void;
  /** 最大长度 */
  maxLength?: number;
  /** 占位符 */
  placeholder?: string;
}

export function HistoryItemEditor({
  value, onSave, onCancel, onDelete, maxLength = 500, placeholder = "编辑历史记录",
}: HistoryItemEditorProps) {
  const [editValue, setEditValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  function handleSave() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      onCancel();
    }
  }

  return (
    <div className="cc-history-item-editor">
      <textarea
        ref={textareaRef}
        className="cc-history-item-textarea"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value.slice(0, maxLength))}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={3}
      />
      <div className="cc-history-item-actions">
        {onDelete && (
          <button className="cc-history-item-btn cc-history-item-delete" onClick={onDelete} title="删除">
            🗑️ 删除
          </button>
        )}
        <button className="cc-history-item-btn cc-history-item-cancel" onClick={onCancel}>
          取消
        </button>
        <button className="cc-history-item-btn cc-history-item-save" onClick={handleSave} disabled={!editValue.trim()}>
          保存
        </button>
      </div>
      <div className="cc-history-item-hint">
        {editValue.length}/{maxLength} · ⌘+Enter 保存 · Esc 取消
      </div>
    </div>
  );
}

export default HistoryItemEditor;
