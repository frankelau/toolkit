// ReasoningSelect.tsx — 推理强度选择器
// 对齐 cc-gui ChatInputBox/selectors/ReasoningSelect.tsx
// 适配：用 ccagent 的 EFFORT_LEVELS 常量 + t() 函数

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { EFFORT_LEVELS } from "../../../constants";
import { t } from "../../../i18n";

const RELATIVE_INLINE_BLOCK_STYLE: CSSProperties = { position: "relative", display: "inline-block" };
const CHEVRON_ICON_STYLE: CSSProperties = { fontSize: "10px", marginLeft: "2px" };
const DROPDOWN_STYLE: CSSProperties = {
  position: "absolute", bottom: "100%", right: 0, marginBottom: "4px", zIndex: 10000,
};
const LEVEL_INFO_STYLE: CSSProperties = { display: "flex", flexDirection: "column", flex: 1 };

const LEVEL_ICONS: Record<string, string> = {
  low: "codicon-symbol-numeric",
  medium: "codicon-lightbulb",
  high: "codicon-mind",
  xhigh: "codicon-flame",
  max: "codicon-rocket",
};

const LEVEL_LABELS: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  xhigh: "超高",
  max: "最大",
};

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  low: "快速响应，浅层推理",
  medium: "平衡模式",
  high: "深度推理",
  xhigh: "更深度推理",
  max: "最大强度推理",
};

export type ReasoningEffort = "low" | "medium" | "high" | "xhigh" | "max";

export interface ReasoningSelectProps {
  value: string;
  onChange: (effort: string) => void;
  disabled?: boolean;
  selectedModel?: string;
  currentProvider?: string;
}

/**
 * ReasoningSelect — 推理强度选择
 * Codex: low/medium/high/xhigh；Claude: low/medium/high/max（视模型支持）。
 */
export function ReasoningSelect({
  value, onChange, disabled, currentProvider,
}: ReasoningSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 可用级别：非 Claude 隐藏 max
  const availableLevels = EFFORT_LEVELS.filter(level => {
    if (currentProvider !== "claude") return level !== "max";
    return true;
  });

  const currentLevel = availableLevels.find(l => l === value) ||
    availableLevels[availableLevels.length - 2] ||
    availableLevels[0];

  const getLabel = (id: string) => LEVEL_LABELS[id] || id;
  const getDescription = (id: string) => LEVEL_DESCRIPTIONS[id] || "";

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    setIsOpen(!isOpen);
  }, [isOpen, disabled]);

  const handleSelect = useCallback((effort: string) => {
    onChange(effort);
    setIsOpen(false);
  }, [onChange]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handleClickOutside), 0);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handleClickOutside); };
  }, [isOpen]);

  return (
    <div style={RELATIVE_INLINE_BLOCK_STYLE}>
      <button
        ref={buttonRef}
        className="selector-button"
        onClick={handleToggle}
        disabled={disabled}
        title={t("reasoning.title") || "选择推理强度"}
      >
        <span className={`codicon ${LEVEL_ICONS[currentLevel] || "codicon-lightbulb"}`} />
        <span className="selector-button-text">{getLabel(currentLevel)}</span>
        <span className={`codicon codicon-chevron-${isOpen ? "up" : "down"}`} style={CHEVRON_ICON_STYLE} />
      </button>

      {isOpen && (
        <div ref={dropdownRef} className="selector-dropdown" style={DROPDOWN_STYLE}>
          {availableLevels.map((level) => (
            <div
              key={level}
              className={`selector-option ${level === value ? "selected" : ""}`}
              onClick={() => handleSelect(level)}
              title={getDescription(level)}
            >
              <span className={`codicon ${LEVEL_ICONS[level] || "codicon-lightbulb"}`} />
              <div style={LEVEL_INFO_STYLE}>
                <span>{getLabel(level)}</span>
                <span className="mode-description">{getDescription(level)}</span>
              </div>
              {level === value && <span className="codicon codicon-check check-mark" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ReasoningSelect;
