// 回退确认弹窗 — Phase 8
// 用户点击消息上的回退按钮时弹出，确认要回退到哪条消息

import { useEffect } from "react";

export interface RewindRequest {
  sessionId: string;
  messageId: string;
  messageContent: string;
  messageTimestamp?: number;
  messagesAfterCount: number;
}

interface RewindDialogProps {
  request: RewindRequest | null;
  loading?: boolean;
  onConfirm: (messageId: string) => void;
  onCancel: () => void;
}

export function RewindDialog({ request, loading = false, onConfirm, onCancel }: RewindDialogProps) {
  useEffect(() => {
    if (!request) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request, onCancel]);

  if (!request) return null;

  const display = request.messageContent.length > 60
    ? request.messageContent.substring(0, 60) + "..."
    : request.messageContent;

  const timeStr = request.messageTimestamp
    ? new Date(request.messageTimestamp).toLocaleString()
    : "";

  return (
    <div className="cc-confirm-overlay" onClick={onCancel}>
      <div className="cc-confirm-dialog" onClick={e => e.stopPropagation()}>
        {loading ? (
          <div className="cc-rewind-loading">
            <div className="cc-rewind-spinner">⏳</div>
            <div>正在恢复文件...</div>
          </div>
        ) : (
          <>
            <div className="cc-confirm-title">⏪ 回退到此处</div>
            <div className="cc-rewind-target">
              <div className="cc-rewind-target-label">回退到:</div>
              <div className="cc-rewind-target-msg">
                {timeStr && <span className="cc-rewind-ts">[{timeStr}]</span>}
                <span className="cc-rewind-content">"{display}"</span>
              </div>
            </div>
            <div className="cc-rewind-warning">
              <div className="cc-rewind-warning-icon">⚠️</div>
              <div className="cc-rewind-warning-content">
                <div className="cc-rewind-warning-title">影响:</div>
                <ul className="cc-rewind-warning-list">
                  <li>将恢复文件到该消息时的状态</li>
                  <li>
                    此后所做的文件改动将丢失
                    {request.messagesAfterCount > 0 && (
                      <span className="cc-rewind-affected">（{request.messagesAfterCount} 条消息受影响）</span>
                    )}
                  </li>
                  <li>对话历史将保留</li>
                </ul>
              </div>
            </div>
            <p className="cc-rewind-note">此操作不可撤销。</p>
            <div className="cc-confirm-actions">
              <button className="cc-confirm-cancel" onClick={onCancel}>取消</button>
              <button className="cc-confirm-ok" onClick={() => onConfirm(request.messageId)} autoFocus>恢复文件</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
