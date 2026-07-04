// CodexFastModeSelect.tsx — Codex 快速模式选择器
// 对齐 cc-gui ChatInputBox/selectors/CodexFastModeSelect.tsx

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { t } from "../../../i18n";

const RELATIVE_INLINE_BLOCK_STYLE: CSSProperties = { position: "relative", display: "inline-block" };
const CHEVRON_ICON_STYLE: CSSProperties = { fontSize: "10px", marginLeft: "2px" };
const DROPDOWN_STYLE: CSSProperties = {
  position: "absolute", bottom: "100%", left: 0, marginBottom: "4px", zIndex: 10000,
};
const MODE_INFO_STYLE: CSSProperties = { display: "flex", flexDirection: "column", flex: 1 };

export type CodexFastMode = "normal" | "fast";

export interface CodexFastModeSelectProps {
  value: CodexFastMode;
  onChange: (mode: CodexFastMode) => void;
}

const CODEX_FAST_MODE_OPTIONS: Array<{
  id: CodexFastMode;
  label: string;
  description: string;
  icon: string;
}> = [
  { id: "normal", label: "标准", description: "使用标准 Codex 服务层级", icon: "codicon-circle-filled" },
  { id: "fast", label: "快速", description: "使用 Codex 快速处理", icon: "codicon-zap" },
];

/**
 * CodexFastModeSelect — Codex 速度模式选择
 * normal（标准）/ fast（快速）。
 */
export function CodexFastModeSelect({ value, onChange }: CodexFastModeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentMode = CODEX_FAST_MODE_OPTIONS.find(m => m.id === value) || CODEX_FAST_MODE_OPTIONS[0];

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  }, [isOpen]);

  const handleSelect = useCallback((mode: CodexFastMode) => {
    onChange(mode);
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
        className={`selector-button${value === "fast" ? " codex-fast-active" : ""}`}
        onClick={handleToggle}
        title={t("codexFastMode.title") || "选择 Codex 速度模式"}
      >
        <span className={`codicon ${currentMode.icon}`} />
        <span className="selector-button-text">{currentMode.label}</span>
        <span className={`codicon codicon-chevron-${isOpen ? "up" : "down"}`} style={CHEVRON_ICON_STYLE} />
      </button>

      {isOpen && (
        <div ref={dropdownRef} className="selector-dropdown" style={DROPDOWN_STYLE}>
          {CODEX_FAST_MODE_OPTIONS.map((mode) => (
            <div
              key={mode.id}
              className={`selector-option ${mode.id === value ? "selected" : ""}`}
              onClick={() => handleSelect(mode.id)}
              title={mode.description}
            >
              <span className={`codicon ${mode.icon}`} />
              <div style={MODE_INFO_STYLE}>
                <span>{mode.label}</span>
                <span className="mode-description">{mode.description}</span>
              </div>
              {mode.id === value && <span className="codicon codicon-check check-mark" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CodexFastModeSelect;
