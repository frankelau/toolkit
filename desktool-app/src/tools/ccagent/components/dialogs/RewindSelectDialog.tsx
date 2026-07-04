// RewindSelectDialog — 选择回退到哪条消息（对齐 cc-gui RewindSelectDialog）
import { useMemo, useEffect } from "react";

export interface RewindableItem {
  messageIndex: number;
  displayContent: string;
  messagesAfterCount: number;
}

export interface RewindSelectDialogProps {
  isOpen: boolean;
  messages: RewindableItem[];
  onSelect: (item: RewindableItem) => void;
  onCancel: () => void;
}

export function RewindSelectDialog({ isOpen, messages, onSelect, onCancel }: RewindSelectDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isOpen, onCancel]);

  const sorted = useMemo(() =>
    [...messages].sort((a, b) => b.messageIndex - a.messageIndex),
  [messages]);

  if (!isOpen) return null;

  return (
    <div className="cc-rewind-overlay" onClick={onCancel}>
      <div className="cc-rewind-dialog" onClick={e => e.stopPropagation()}>
        <h3 className="cc-rewind-title">↺ 选择回溯点</h3>
        {sorted.length === 0 ? (
          <div className="cc-rewind-empty">当前会话中无可回溯的消息</div>
        ) : (
          <div className="cc-rewind-list">
            {sorted.map((item, idx) => (
              <div key={item.messageIndex} className="cc-rewind-item" onClick={() => onSelect(item)}>
                <span className="cc-rewind-idx">[{sorted.length - idx}]</span>
                <span className="cc-rewind-text" title={item.displayContent}>
                  {item.displayContent.length > 60 ? item.displayContent.slice(0, 60) + "…" : item.displayContent}
                </span>
                {item.messagesAfterCount > 0 && (
                  <span className="cc-rewind-affected">{item.messagesAfterCount} 条消息受影响</span>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="cc-rewind-footer">
          <button className="cc-rewind-cancel-btn" onClick={onCancel}>取消</button>
        </div>
      </div>
    </div>
  );
}
