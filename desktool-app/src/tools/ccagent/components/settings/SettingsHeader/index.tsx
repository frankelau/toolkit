// SettingsHeader — 设置面板头部（对齐 cc-gui SettingsHeader）
// Sprint D: 标题 + 关闭按钮

interface SettingsHeaderProps {
  title: string;
  onClose: () => void;
}

export function SettingsHeader({ title, onClose }: SettingsHeaderProps) {
  return (
    <div className="cc-settings-header">
      <h2 className="cc-settings-header-title">⚙️ {title}</h2>
      <button className="cc-settings-close" onClick={onClose} title="关闭">×</button>
    </div>
  );
}
