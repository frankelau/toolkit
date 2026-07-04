// Toast — 轻量 toast 通知

import { useEffect } from "react";

export type ToastType = "info" | "success" | "error" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="cc-toast-container">
      {toasts.map(t => (
        <ToastItemView key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItemView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const duration = toast.duration ?? 3000;
    const id = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(id);
  }, [toast, onDismiss]);

  const icon = toast.type === "success" ? "✓" : toast.type === "error" ? "✗" : toast.type === "warning" ? "⚠" : "ℹ";
  return (
    <div className={`cc-toast cc-toast-${toast.type}`} onClick={() => onDismiss(toast.id)}>
      <span className="cc-toast-icon">{icon}</span>
      <span className="cc-toast-msg">{toast.message}</span>
    </div>
  );
}
