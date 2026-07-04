// UndoConfirmDialog — 撤销单文件变更确认弹窗

import { ConfirmDialog } from "../common";

export interface UndoConfirmDialogProps {
  isOpen: boolean;
  filePath: string;
  additions: number;
  deletions: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UndoConfirmDialog(props: UndoConfirmDialogProps) {
  const { isOpen, filePath, additions, deletions, onConfirm, onCancel } = props;
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="撤销该文件变更？"
      message={`将丢弃 ${filePath} 的未提交修改（+${additions} / -${deletions} 行）。执行 git checkout HEAD -- ${filePath}`}
      confirmText="确认撤销"
      variant="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
