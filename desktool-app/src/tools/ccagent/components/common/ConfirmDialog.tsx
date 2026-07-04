// ConfirmDialog — 通用确认弹窗

import { useState } from "react";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const { isOpen, title, message, confirmText = "确认", cancelText = "取消", variant = "default", onConfirm, onCancel } = props;
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cc-confirm-overlay" onClick={onCancel}>
      <div className="cc-confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="cc-confirm-title">{title}</div>
        <div className="cc-confirm-msg">{message}</div>
        <div className="cc-confirm-actions">
          <button className="cc-confirm-cancel" onClick={onCancel} disabled={loading}>{cancelText}</button>
          <button
            className={`cc-confirm-ok ${variant === "danger" ? "danger" : ""}`}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
