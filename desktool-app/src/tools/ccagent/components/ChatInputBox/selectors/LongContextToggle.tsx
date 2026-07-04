// LongContextToggle.tsx — 长上下文开关
// 对齐 cc-gui ChatInputBox/selectors/LongContextToggle.tsx
// 适配：用原生 checkbox 替代 antd Switch

import type { CSSProperties } from "react";
import { t } from "../../../i18n";

/** 支持 1M 上下文的模型 ID 后缀或集合 */
const MODELS_WITH_1M: ReadonlySet<string> = new Set([
  "claude-opus-4-6", "claude-opus-4-6[1m]",
  "claude-sonnet-4-6", "claude-sonnet-4-6[1m]",
  "deepseek-v4-pro[1m]",
]);

/** 判断模型是否支持 1M 长上下文 */
export function modelSupports1MContext(modelId: string): boolean {
  if (!modelId) return false;
  if (modelId.endsWith("[1m]")) return true;
  return MODELS_WITH_1M.has(modelId);
}

const TOGGLE_BASE_STYLE: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "4px", marginLeft: "4px",
};

const LABEL_BASE_STYLE: CSSProperties = {
  fontSize: "11px", fontWeight: 500,
};

export interface LongContextToggleProps {
  /** 当前模型 ID（决定开关是否可用） */
  modelId: string;
  /** 是否启用长上下文 */
  enabled: boolean;
  /** 切换回调 */
  onChange: (enabled: boolean) => void;
}

/**
 * LongContextToggle — 1M 上下文窗口开关
 * 放在模型选择器旁边，仅对支持 1M 的模型启用。
 */
export function LongContextToggle({ modelId, enabled, onChange }: LongContextToggleProps) {
  const supports1M = modelSupports1MContext(modelId);
  const displayEnabled = supports1M ? enabled : false;

  const wrapperStyle: CSSProperties = {
    ...TOGGLE_BASE_STYLE, opacity: supports1M ? 1 : 0.5,
  };

  const labelStyle: CSSProperties = {
    ...LABEL_BASE_STYLE,
    color: displayEnabled ? "var(--text-link-active, #185FA5)" : "var(--text-secondary, #888)",
  };

  return (
    <div
      className="long-context-toggle"
      style={wrapperStyle}
      title={supports1M
        ? (t("models.longContext.tooltipEnabled") || "启用 1M 长上下文")
        : (t("models.longContext.tooltipDisabled") || "当前模型不支持长上下文")
      }
    >
      <span style={labelStyle}>{t("models.longContext.label") || "长上下文"}</span>
      <input
        type="checkbox"
        checked={displayEnabled}
        disabled={!supports1M}
        onChange={(e) => onChange(e.target.checked)}
        style={{ cursor: supports1M ? "pointer" : "not-allowed" }}
      />
    </div>
  );
}

export default LongContextToggle;
