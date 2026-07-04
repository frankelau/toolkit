// BasicConfigSection/AppearanceTab.tsx — 外观设置 tab
// 对齐 cc-gui 的 BasicConfigSection/AppearanceTab.tsx
// 包含：主题、字号、聊天背景色、用户消息色、diff 主题

import { useLocale } from "../../../hooks/useLocale";
import {
  SECTION_TITLE_STYLE, FORM_ROW_STYLE, LABEL_STYLE, VALUE_CONTAINER_STYLE,
  DESCRIPTION_STYLE, INPUT_STYLE, SELECT_STYLE,
} from "../shared";

type ThemePreference = "light" | "dark" | "system";
type DiffThemeMode = "light" | "dark" | "auto";

interface AppearanceTabProps {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  fontSizeLevel: number;
  onFontSizeLevelChange: (level: number) => void;
  chatBgColor?: string;
  onChatBgColorChange?: (color: string) => void;
  userMsgColor?: string;
  onUserMsgColorChange?: (color: string) => void;
  diffTheme?: DiffThemeMode;
  onDiffThemeChange?: (theme: DiffThemeMode) => void;
  diffExpandedByDefault?: boolean;
  onDiffExpandedByDefaultChange?: (enabled: boolean) => void;
}

export default function AppearanceTab({
  theme,
  onThemeChange,
  fontSizeLevel,
  onFontSizeLevelChange,
  chatBgColor,
  onChatBgColorChange,
  userMsgColor,
  onUserMsgColorChange,
  diffTheme,
  onDiffThemeChange,
  diffExpandedByDefault,
  onDiffExpandedByDefaultChange,
}: AppearanceTabProps) {
  const { t } = useLocale();
  return (
    <div className="cc-settings-tab-content">
      <h4 style={SECTION_TITLE_STYLE}>{t("appearanceTab.appearanceTab.k1")}</h4>

      {/* 主题 */}
      <div style={FORM_ROW_STYLE}>
        <label style={LABEL_STYLE}>{t("appearanceTab.appearanceTab.k2")}</label>
        <div style={VALUE_CONTAINER_STYLE}>
          <select
            style={SELECT_STYLE}
            value={theme}
            onChange={e => onThemeChange(e.target.value as ThemePreference)}
          >
            <option value="system">{t("appearanceTab.appearanceTab.k3")}</option>
            <option value="light">{t("appearanceTab.appearanceTab.k4")}</option>
            <option value="dark">{t("appearanceTab.appearanceTab.k5")}</option>
          </select>
          <div style={DESCRIPTION_STYLE}>{t("appearanceTab.appearanceTab.k6")}</div>
        </div>
      </div>

      {/* 字号 */}
      <div style={FORM_ROW_STYLE}>
        <label style={LABEL_STYLE}>{t("appearanceTab.appearanceTab.k7")}</label>
        <div style={VALUE_CONTAINER_STYLE}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="range"
              min={-2}
              max={4}
              step={1}
              value={fontSizeLevel}
              onChange={e => onFontSizeLevelChange(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: "12px", minWidth: "40px", color: "var(--text-muted, #888)" }}>
              {fontSizeLevel > 0 ? `+${fontSizeLevel}` : fontSizeLevel}
            </span>
          </div>
          <div style={DESCRIPTION_STYLE}>{t("appearanceTab.appearanceTab.k8")}</div>
        </div>
      </div>

      {/* 聊天背景色 */}
      {chatBgColor !== undefined && onChatBgColorChange && (
        <div style={FORM_ROW_STYLE}>
          <label style={LABEL_STYLE}>{t("appearanceTab.appearanceTab.k9")}</label>
          <div style={VALUE_CONTAINER_STYLE}>
            <input
              type="color"
              value={chatBgColor}
              onChange={e => onChatBgColorChange(e.target.value)}
              style={{ width: "40px", height: "28px", border: "1px solid var(--border, #555)", borderRadius: "4px", cursor: "pointer" }}
            />
            <input
              type="text"
              style={{ ...INPUT_STYLE, marginLeft: "8px" }}
              value={chatBgColor}
              onChange={e => onChatBgColorChange(e.target.value)}
              placeholder="#1e1e1e"
            />
          </div>
        </div>
      )}

      {/* 用户消息色 */}
      {userMsgColor !== undefined && onUserMsgColorChange && (
        <div style={FORM_ROW_STYLE}>
          <label style={LABEL_STYLE}>{t("appearanceTab.appearanceTab.k10")}</label>
          <div style={VALUE_CONTAINER_STYLE}>
            <input
              type="color"
              value={userMsgColor}
              onChange={e => onUserMsgColorChange(e.target.value)}
              style={{ width: "40px", height: "28px", border: "1px solid var(--border, #555)", borderRadius: "4px", cursor: "pointer" }}
            />
            <input
              type="text"
              style={{ ...INPUT_STYLE, marginLeft: "8px" }}
              value={userMsgColor}
              onChange={e => onUserMsgColorChange(e.target.value)}
              placeholder="#2a2a3a"
            />
          </div>
        </div>
      )}

      {/* Diff 主题 */}
      {diffTheme !== undefined && onDiffThemeChange && (
        <div style={FORM_ROW_STYLE}>
          <label style={LABEL_STYLE}>{t("appearanceTab.appearanceTab.k11")}</label>
          <div style={VALUE_CONTAINER_STYLE}>
            <select
              style={SELECT_STYLE}
              value={diffTheme}
              onChange={e => onDiffThemeChange(e.target.value as DiffThemeMode)}
            >
              <option value="auto">{t("appearanceTab.appearanceTab.k12")}</option>
              <option value="light">{t("appearanceTab.appearanceTab.k13")}</option>
              <option value="dark">{t("appearanceTab.appearanceTab.k14")}</option>
            </select>
            <div style={DESCRIPTION_STYLE}>{t("appearanceTab.appearanceTab.k15")}</div>
          </div>
        </div>
      )}

      {/* Diff 默认展开 */}
      {diffExpandedByDefault !== undefined && onDiffExpandedByDefaultChange && (
        <div style={FORM_ROW_STYLE}>
          <label style={LABEL_STYLE}>{t("appearanceTab.appearanceTab.k16")}</label>
          <div style={VALUE_CONTAINER_STYLE}>
            <label className="cc-toggle-switch">
              <input
                type="checkbox"
                checked={diffExpandedByDefault}
                onChange={e => onDiffExpandedByDefaultChange(e.target.checked)}
              />
              <span className="cc-toggle-slider" />
            </label>
            <div style={DESCRIPTION_STYLE}>{t("appearanceTab.appearanceTab.k17")}</div>
          </div>
        </div>
      )}
    </div>
  );
}
