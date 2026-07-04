// AlertDialog — 警告对话框
// 对齐 cc-gui 的 AlertDialog.tsx
// 用于展示 info/warning/error/success 四种类型的单按钮提示弹窗

import { useEffect } from "react";
import { ErrorIcon, WarningIcon, SuccessIcon, InfoIcon } from "./Icons";

export type AlertType = "error" | "warning" | "info" | "success";

const DIALOG_HEADER_STYLE: React.CSSProperties = { display: "flex", alignItems: "center" };
const DIALOG_TITLE_STYLE: React.CSSProperties = { margin: 0, lineHeight: 1.2 };
const PRE_WRAP_STYLE: React.CSSProperties = { whiteSpace: "pre-wrap" };
const JUSTIFY_CENTER_STYLE: React.CSSProperties = { justifyContent: "center" };

interface AlertDialogProps {
  isOpen: boolean;
  type?: AlertType;
  title: string;
  message: string;
  confirmText?: string;
  onClose: () => void;
}

export function AlertDialog({
  isOpen,
  type = "info",
  title,
  message,
  confirmText,
  onClose,
}: AlertDialogProps) {
  const buttonText = confirmText || "确定";

  // Esc/Enter 关闭
  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape" || e.key === "Enter") {
          onClose();
        }
      };
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    const iconSize = 16;
    const iconStyle: React.CSSProperties = { marginRight: "8px", flex: "none" };
    switch (type) {
      case "error": return <ErrorIcon size={iconSize} style={{ color: "#f48771", ...iconStyle }} />;
      case "warning": return <WarningIcon size={iconSize} style={{ color: "#cca700", ...iconStyle }} />;
      case "success": return <SuccessIcon size={iconSize} style={{ color: "#89d185", ...iconStyle }} />;
      default: return <InfoIcon size={iconSize} style={{ color: "#75beff", ...iconStyle }} />;
    }
  };

  return (
    <div className="cc-confirm-dialog-overlay" onClick={onClose}>
      <div className="cc-confirm-dialog cc-alert-dialog" onClick={e => e.stopPropagation()}>
        <div className="cc-confirm-dialog-header" style={DIALOG_HEADER_STYLE}>
          {getIcon()}
          <h3 className="cc-confirm-dialog-title" style={DIALOG_TITLE_STYLE}>{title}</h3>
        </div>
        <div className="cc-confirm-dialog-body">
          <p className="cc-confirm-dialog-message" style={PRE_WRAP_STYLE}>{message}</p>
        </div>
        <div className="cc-confirm-dialog-footer" style={JUSTIFY_CENTER_STYLE}>
          <button className="cc-confirm-dialog-button cc-confirm-button" onClick={onClose} autoFocus>
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AlertDialog;
