// SkillConfirmDialog — Skill 确认对话框
// 对齐 cc-gui skills/SkillConfirmDialog.tsx
// 用于危险操作（删除 Skill 等）的二次确认

export interface SkillConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SkillConfirmDialog({
  title, message, confirmText = "确认", cancelText = "取消", onConfirm, onCancel,
}: SkillConfirmDialogProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div className="skill-dialog-backdrop" onClick={handleBackdropClick}>
      <div className="skill-dialog confirm-dialog">
        <div className="dialog-header">
          <h3>{title}</h3>
          <button className="close-btn" onClick={onCancel}>
            <span className="codicon codicon-close" />
          </button>
        </div>
        <div className="dialog-content">
          <div className="confirm-message">
            <span className="codicon codicon-warning warning-icon" />
            <p>{message}</p>
          </div>
        </div>
        <div className="dialog-footer">
          <button className="btn-secondary" onClick={onCancel}>{cancelText}</button>
          <button className="btn-danger" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

export default SkillConfirmDialog;
