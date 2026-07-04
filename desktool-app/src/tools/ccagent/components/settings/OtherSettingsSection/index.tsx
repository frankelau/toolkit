// OtherSettingsSection — 其它设置（对齐 cc-gui OtherSettingsSection）
// Sprint D: 声音/通知/主题等杂项

import { toast } from "../../../../../useCopyFeedback";
import { exportSettingsToFile, importSettingsFromFile } from "../../../utils/settingsExport";

interface OtherSettingsSectionProps {
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  notificationEnabled: boolean;
  setNotificationEnabled: (v: boolean) => void;
  theme: "auto" | "light" | "dark";
  setTheme: (v: "auto" | "light" | "dark") => void;
  onImportSettings?: (profile: Record<string, unknown>) => void;
  language: "zh" | "en";
  setLanguage: (v: "zh" | "en") => void;
  newSessionConfirm: boolean;
  setNewSessionConfirm: (v: boolean) => void;
}

export function OtherSettingsSection(props: OtherSettingsSectionProps) {
  return (
    <div className="cc-settings-block">
      <div className="cc-settings-block-title">🔧 其它设置</div>

      <div className="cc-setting-row">
        <label>主题</label>
        <select value={props.theme} onChange={e => props.setTheme(e.target.value as "auto" | "light" | "dark")}>
          <option value="auto">跟随系统</option>
          <option value="light">浅色</option>
          <option value="dark">深色</option>
        </select>
      </div>

      <div className="cc-setting-row">
        <label>语言</label>
        <select value={props.language} onChange={e => props.setLanguage(e.target.value as "zh" | "en")}>
          <option value="zh">简体中文</option>
          <option value="en">English</option>
        </select>
      </div>

      <div className="cc-setting-row">
        <label>操作声音</label>
        <label className="cc-toggle-switch">
          <input type="checkbox" checked={props.soundEnabled} onChange={e => props.setSoundEnabled(e.target.checked)} />
          <span className="cc-toggle-slider"></span>
          <span className="cc-toggle-label">{props.soundEnabled ? "开启" : "关闭"}</span>
        </label>
      </div>

      <div className="cc-setting-row">
        <label>桌面通知</label>
        <label className="cc-toggle-switch">
          <input type="checkbox" checked={props.notificationEnabled} onChange={e => props.setNotificationEnabled(e.target.checked)} />
          <span className="cc-toggle-slider"></span>
          <span className="cc-toggle-label">{props.notificationEnabled ? "开启" : "关闭"}</span>
        </label>
      </div>

      <div className="cc-setting-row">
        <label>新建会话确认</label>
        <label className="cc-toggle-switch">
          <input type="checkbox" checked={props.newSessionConfirm} onChange={e => props.setNewSessionConfirm(e.target.checked)} />
          <span className="cc-toggle-slider"></span>
          <span className="cc-toggle-label">{props.newSessionConfirm ? "开启" : "关闭"}</span>
        </label>
      </div>

      <div className="cc-setting-row">
        <label>设置</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="cc-setting-btn" onClick={() => exportSettingsToFile({
            engine: "claude", model: "", cwd: "",
            systemPrompt: "", mcpConfig: "{}", permissionMode: "default",
            streamingEnabled: true, thinkingEnabled: true, providerId: "official",
            providerBaseUrl: "", favorites: [],
          })}>📤 导出</button>
          <button className="cc-setting-btn" onClick={async () => {
            const profile = await importSettingsFromFile();
            if (profile) {
              if (props.onImportSettings) props.onImportSettings(profile as unknown as Record<string, unknown>);
              toast("设置已导入", "success");
            }
          }}>📥 导入</button>
        </div>
      </div>
    </div>
  );
}
