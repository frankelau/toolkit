// DiscardAllDialog — 撤销所有文件变更确认弹窗

import { ConfirmDialog } from "../common";

export interface DiscardAllDialogProps {
  isOpen: boolean;
  fileCount: number;
  totalAdditions: number;
  totalDeletions: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DiscardAllDialog(props: DiscardAllDialogProps) {
  const { isOpen, fileCount, totalAdditions, totalDeletions, onConfirm, onCancel } = props;
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="撤销所有文件变更？"
      message={`将丢弃 ${fileCount} 个文件的未提交修改（+${totalAdditions} / -${totalDeletions} 行）。此操作不可逆，执行 git checkout HEAD -- .`}
      confirmText="确认撤销"
      variant="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
