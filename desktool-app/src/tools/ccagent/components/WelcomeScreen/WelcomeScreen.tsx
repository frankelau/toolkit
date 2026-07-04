// WelcomeScreen — 空会话欢迎页
// 对齐 cc-gui 的 WelcomeScreen/WelcomeScreen.tsx
// 展示 BlinkingLogo + 版本标签 + AnimatedText 提示语

import { memo } from "react";
import { BlinkingLogo } from "../BlinkingLogo";
import { AnimatedText } from "../AnimatedText";

const ROOT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "#555",
  gap: "16px",
};

const LOGO_WRAPPER_STYLE: React.CSSProperties = { position: "relative", display: "inline-block" };
const VERSION_TAG_STYLE: React.CSSProperties = { cursor: "pointer" };

/** 应用版本号 */
export const APP_VERSION = "1.0.0";

export interface WelcomeScreenProps {
  currentProvider: string;
  /** 当前模型 ID（用于厂商特定图标） */
  currentModelId?: string;
  onProviderChange: (provider: string) => void;
  onVersionClick?: () => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  claude: "Claude",
  codex: "Codex",
  gemini: "Gemini",
  qwen: "通义千问",
  deepseek: "DeepSeek",
  kimi: "Kimi",
  zhipu: "智谱 GLM",
  minimax: "MiniMax",
  openrouter: "OpenRouter",
};

export const WelcomeScreen = memo(function WelcomeScreen({
  currentProvider,
  currentModelId,
  onProviderChange,
  onVersionClick,
}: WelcomeScreenProps): React.ReactElement {
  const providerLabel = PROVIDER_LABELS[currentProvider] ?? currentProvider;
  const hintText = `使用 ${providerLabel} 开始对话...`;

  return (
    <div style={ROOT_STYLE}>
      <div style={LOGO_WRAPPER_STYLE}>
        <BlinkingLogo provider={currentProvider} modelId={currentModelId} onProviderChange={onProviderChange} />
        <span
          className="cc-version-tag"
          role="button"
          tabIndex={0}
          style={VERSION_TAG_STYLE}
          onClick={onVersionClick}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onVersionClick?.(); }}
        >
          v{APP_VERSION}
        </span>
      </div>
      <div>
        <AnimatedText text={hintText} />
      </div>
    </div>
  );
});
