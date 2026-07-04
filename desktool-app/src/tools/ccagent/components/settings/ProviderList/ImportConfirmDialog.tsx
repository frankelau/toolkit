// ImportConfirmDialog.tsx — Provider 导入确认对话框
// 对齐 cc-gui ProviderList/ImportConfirmDialog.tsx
// 用于导入 Provider 配置时的冲突确认

export interface ImportPreviewItem {
  id: string;
  name: string;
  action: "create" | "overwrite" | "skip";
}

export interface ImportConfirmDialogProps {
  /** 导入预览项列表 */
  items: ImportPreviewItem[];
  /** 确认导入 */
  onConfirm: () => void;
  /** 取消 */
  onCancel: () => void;
  /** 导入源名称 */
  sourceName?: string;
}

const ACTION_LABEL: Record<ImportPreviewItem["action"], string> = {
  create: "新建",
  overwrite: "覆盖",
  skip: "跳过",
};

const ACTION_CLASS: Record<ImportPreviewItem["action"], string> = {
  create: "cc-import-action-create",
  overwrite: "cc-import-action-overwrite",
  skip: "cc-import-action-skip",
};

export function ImportConfirmDialog({
  items, onConfirm, onCancel, sourceName = "剪贴板",
}: ImportConfirmDialogProps) {
  const createCount = items.filter(i => i.action === "create").length;
  const overwriteCount = items.filter(i => i.action === "overwrite").length;
  const skipCount = items.filter(i => i.action === "skip").length;

  return (
    <div className="cc-import-dialog-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="cc-import-dialog">
        <div className="cc-import-dialog-header">
          <h3>确认导入 Provider</h3>
          <button className="cc-close-btn" onClick={onCancel}>✕</button>
        </div>

        <div className="cc-import-dialog-content">
          <p className="cc-import-source">来源：{sourceName}</p>

          <div className="cc-import-summary">
            <span className="cc-import-summary-create">新建 {createCount}</span>
            <span className="cc-import-summary-overwrite">覆盖 {overwriteCount}</span>
            <span className="cc-import-summary-skip">跳过 {skipCount}</span>
          </div>

          <div className="cc-import-list">
            {items.map((item) => (
              <div key={item.id} className="cc-import-item">
                <span className="cc-import-item-name">{item.name}</span>
                <span className={`cc-import-action ${ACTION_CLASS[item.action]}`}>
                  {ACTION_LABEL[item.action]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="cc-import-dialog-footer">
          <button className="cc-btn-secondary" onClick={onCancel}>取消</button>
          <button className="cc-btn-primary" onClick={onConfirm}>确认导入</button>
        </div>
      </div>
    </div>
  );
}

export default ImportConfirmDialog;
