// ModeSelect.tsx — 权限模式选择器
// 对齐 cc-gui ChatInputBox/selectors/ModeSelect.tsx
// 适配：用 ccagent 的 PERMISSION_MODES 常量 + t() 函数

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { PERMISSION_MODES } from "../../../constants";

const RELATIVE_INLINE_BLOCK_STYLE: CSSProperties = { position: "relative", display: "inline-block" };
const CHEVRON_ICON_STYLE: CSSProperties = { fontSize: "10px", marginLeft: "2px" };
const DROPDOWN_STYLE: CSSProperties = {
  position: "absolute", bottom: "100%", left: 0, marginBottom: "4px", zIndex: 10000,
};
const MODE_INFO_STYLE: CSSProperties = { display: "flex", flexDirection: "column", flex: 1 };

const MODE_ICONS: Record<string, string> = {
  default: "codicon-lock",
  acceptEdits: "codicon-edit",
  bypassPermissions: "codicon-unlock",
  plan: "codicon-list-tree",
};

export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan";

export interface ModeSelectProps {
  value: string;
  onChange: (mode: string) => void;
  provider?: string;
}

/**
 * ModeSelect — 权限模式选择
 * 支持 default / acceptEdits / bypassPermissions / plan。
 * Codex provider 下隐藏 plan 模式。
 */
export function ModeSelect({ value, onChange, provider }: ModeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const modeOptions = useMemo(() => {
    if (provider === "codex") {
      return PERMISSION_MODES.filter(m => m.value !== "plan");
    }
    return PERMISSION_MODES;
  }, [provider]);

  const currentMode = modeOptions.find(m => m.value === value) || modeOptions[0];

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  }, [isOpen]);

  const handleSelect = useCallback((mode: string) => {
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

  const icon = MODE_ICONS[currentMode?.value] || "codicon-circle-filled";

  return (
    <div style={RELATIVE_INLINE_BLOCK_STYLE}>
      <button
        ref={buttonRef}
        className={`selector-button${value === "bypassPermissions" ? " mode-auto-active" : ""}`}
        onClick={handleToggle}
        title={currentMode?.label}
      >
        <span className={`codicon ${icon}`} />
        <span className="selector-button-text">{currentMode?.label}</span>
        <span className={`codicon codicon-chevron-${isOpen ? "up" : "down"}`} style={CHEVRON_ICON_STYLE} />
      </button>

      {isOpen && (
        <div ref={dropdownRef} className="selector-dropdown" style={DROPDOWN_STYLE}>
          {modeOptions.map((mode) => (
            <div
              key={mode.value}
              className={`selector-option ${mode.value === value ? "selected" : ""}`}
              onClick={() => handleSelect(mode.value)}
              title={mode.label}
            >
              <span className={`codicon ${MODE_ICONS[mode.value] || "codicon-circle-filled"}`} />
              <div style={MODE_INFO_STYLE}>
                <span>{mode.label}</span>
              </div>
              {mode.value === value && <span className="codicon codicon-check check-mark" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ModeSelect;
