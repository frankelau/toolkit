// AiFeatureSettingsCard/index.tsx — AI 功能设置卡片
// 对齐 cc-gui 的 AiFeatureSettingsCard/index.tsx
// 封装开关 + Provider/Model 面板，用于 Prompt 增强、提交信息等 AI 功能的开关与配置

import type { CSSProperties } from "react";
import AiFeatureProviderModelPanel, { type AiFeatureConfig } from "../AiFeatureProviderModelPanel";
import { CARD_STYLE, DESCRIPTION_STYLE } from "../shared";

interface AiFeatureSettingsCardProps {
  title: string;
  description?: string;
  /** 功能开关 */
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  /** Provider/Model 配置 */
  config: AiFeatureConfig;
  onConfigChange: (config: AiFeatureConfig) => void;
  /** 可用 Provider 列表 */
  providers: { id: string; name: string; models: { value: string; label: string }[] }[];
  defaultProviderId?: string;
  defaultModelId?: string;
  /** 重置回调 */
  onReset?: () => void;
}

const HEADER_STYLE: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "12px",
};

const TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: "14px",
  fontWeight: 600,
};

const RESET_BUTTON_STYLE: CSSProperties = {
  background: "none",
  border: "1px solid var(--border, #555)",
  borderRadius: "4px",
  color: "var(--text-muted, #888)",
  cursor: "pointer",
  padding: "3px 10px",
  fontSize: "11px",
};

export default function AiFeatureSettingsCard({
  title,
  description,
  enabled,
  onEnabledChange,
  config,
  onConfigChange,
  providers,
  defaultProviderId,
  defaultModelId,
  onReset,
}: AiFeatureSettingsCardProps) {
  return (
    <div style={CARD_STYLE}>
      <div style={HEADER_STYLE}>
        <div>
          <h4 style={TITLE_STYLE}>{title}</h4>
          {description && <div style={DESCRIPTION_STYLE}>{description}</div>}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {onReset && (
            <button style={RESET_BUTTON_STYLE} onClick={onReset}>
              重置默认
            </button>
          )}
          <label className="cc-toggle-switch">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => onEnabledChange(e.target.checked)}
            />
            <span className="cc-toggle-slider" />
          </label>
        </div>
      </div>

      {enabled && (
        <AiFeatureProviderModelPanel
          title="Provider / Model 配置"
          config={config}
          onChange={onConfigChange}
          providers={providers}
          defaultProviderId={defaultProviderId}
          defaultModelId={defaultModelId}
        />
      )}
    </div>
  );
}
