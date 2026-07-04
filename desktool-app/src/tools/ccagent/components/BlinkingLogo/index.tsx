// BlinkingLogo — 闪烁切换的 Provider Logo
// 对齐 cc-gui 的 BlinkingLogo/index.tsx
// provider 变化时：当前 logo 先收起，再展开新 logo；点击可切换 provider

import { useEffect, useRef, useState } from "react";
import { ProviderModelIcon } from "../shared/ProviderModelIcon";

const ROOT_STYLE: React.CSSProperties = {
  position: "relative",
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
};

const DROPDOWN_STYLE: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: "50%",
  transform: "translateX(-50%)",
  marginTop: "8px",
  zIndex: 10000,
};

function getProviderOptionStyle(enabled: boolean): React.CSSProperties {
  return {
    opacity: enabled ? 1 : 0.5,
    cursor: enabled ? "pointer" : "not-allowed",
  };
}

/** 可用的 Provider 列表 */
const AVAILABLE_PROVIDERS: { id: string; label: string; enabled: boolean }[] = [
  { id: "claude", label: "Claude", enabled: true },
  { id: "codex", label: "Codex (OpenAI)", enabled: true },
  { id: "gemini", label: "Gemini", enabled: false },
  { id: "qwen", label: "通义千问", enabled: false },
  { id: "deepseek", label: "DeepSeek", enabled: false },
  { id: "kimi", label: "Kimi", enabled: false },
  { id: "zhipu", label: "智谱 GLM", enabled: false },
  { id: "minimax", label: "MiniMax", enabled: false },
  { id: "openrouter", label: "OpenRouter", enabled: false },
];

interface BlinkingLogoProps {
  provider: string;
  /** 当前模型 ID（用于厂商特定图标） */
  modelId?: string;
  onProviderChange?: (providerId: string) => void;
}

export function BlinkingLogo({ provider, modelId, onProviderChange }: BlinkingLogoProps) {
  const [displayProvider, setDisplayProvider] = useState(provider);
  const [displayModelId, setDisplayModelId] = useState(modelId);
  const [animationState, setAnimationState] = useState<"idle" | "closing" | "opening">("idle");

  const [isOpen, setIsOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // provider 变化时触发动画
  useEffect(() => {
    if (provider !== displayProvider || modelId !== displayModelId) {
      if (animationState === "idle" || animationState === "opening") {
        setAnimationState("closing");
      }
    }
  }, [provider, modelId, displayProvider, displayModelId, animationState]);

  // 动画状态机
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (animationState === "closing") {
      timer = setTimeout(() => {
        setDisplayProvider(provider);
        setDisplayModelId(modelId);
        setAnimationState("opening");
      }, 200);
    } else if (animationState === "opening") {
      timer = setTimeout(() => {
        setAnimationState("idle");
      }, 200);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [animationState, provider, modelId]);

  // 点击外部关闭下拉
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        containerRef.current && !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    if (onProviderChange) {
      e.stopPropagation();
      setIsOpen(!isOpen);
    }
  };

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 1500);
  };

  const handleSelect = (providerId: string) => {
    const p = AVAILABLE_PROVIDERS.find(p => p.id === providerId);
    if (!p) return;
    if (!p.enabled) {
      showToastMessage("该 Provider 即将支持");
      setIsOpen(false);
      return;
    }
    if (onProviderChange) onProviderChange(providerId);
    setIsOpen(false);
  };

  const getProviderLabel = (providerId: string) => {
    return AVAILABLE_PROVIDERS.find(p => p.id === providerId)?.label || providerId;
  };

  const logoStyle: React.CSSProperties = {
    cursor: onProviderChange ? "pointer" : "default",
  };

  return (
    <div style={ROOT_STYLE}>
      <div
        ref={containerRef}
        className={`cc-blinking-logo cc-blink-${animationState}`}
        onClick={handleToggle}
        style={logoStyle}
      >
        <ProviderModelIcon
          providerId={displayProvider}
          modelId={displayModelId}
          size={displayProvider === "codex" ? 64 : 58}
          colored
        />
      </div>

      {isOpen && (
        <div ref={dropdownRef} className="cc-selector-dropdown" style={DROPDOWN_STYLE}>
          {AVAILABLE_PROVIDERS.map(p => (
            <div
              key={p.id}
              className={`cc-selector-option ${p.id === provider ? "selected" : ""} ${!p.enabled ? "disabled" : ""}`}
              onClick={e => {
                e.stopPropagation();
                handleSelect(p.id);
              }}
              style={getProviderOptionStyle(!!p.enabled)}
            >
              <ProviderModelIcon providerId={p.id} size={16} colored />
              <span>{getProviderLabel(p.id)}</span>
              {p.id === provider && <span className="cc-check-mark">✓</span>}
            </div>
          ))}
        </div>
      )}

      {showToast && (
        <div className="cc-selector-toast">{toastMessage}</div>
      )}
    </div>
  );
}
