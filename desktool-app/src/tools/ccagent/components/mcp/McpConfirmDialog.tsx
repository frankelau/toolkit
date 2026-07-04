// McpConfirmDialog — MCP 确认弹窗
// Sprint C: 删除服务器/清空配置等危险操作确认

interface McpConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function McpConfirmDialog({
  isOpen, title, message,
  confirmText = "确认", cancelText = "取消",
  danger = false, onConfirm, onCancel,
}: McpConfirmDialogProps) {
  if (!isOpen) return null;
  return (
    <div className="cc-mcp-dialog-overlay" onClick={onCancel}>
      <div className="cc-mcp-confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="cc-mcp-confirm-title">{title}</div>
        <div className="cc-mcp-confirm-msg">{message}</div>
        <div className="cc-mcp-dialog-actions">
          <button className="cc-mcp-cancel" onClick={onCancel}>{cancelText}</button>
          <button
            className={danger ? "cc-mcp-danger-btn" : "cc-mcp-save"}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
