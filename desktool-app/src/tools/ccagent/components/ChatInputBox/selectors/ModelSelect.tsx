// ModelSelect — 模型选择器（对齐 cc-gui ModelSelect）
// Sprint U1: 深化实现 — 自定义模型 + 模型映射 + 1M 上下文 + 描述展示

import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../../../i18n";
import { ProviderModelIcon } from "../../shared/ProviderModelIcon";
import {
  normalizeClaudeModelId,
  strip1MContextSuffix,
  apply1MContextSuffix,
  has1MContextSuffix,
} from "../types";
import { sendBridgeEventQuiet } from "../../../utils/bridge";

// ─── 类型 ────────────────────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  label: string;
  description?: string;
  contextWindow?: number;
  supports1MContext?: boolean;
  maxOutputTokens?: number;
}

interface ModelSelectProps {
  value: string;
  onChange: (modelId: string) => void;
  currentProvider?: string;
  onAddModel?: () => void;
  longContextEnabled?: boolean;
  onLongContextChange?: (enabled: boolean) => void;
}

// ─── 默认模型列表 ────────────────────────────────────────────────────────────

export const AVAILABLE_MODELS: ModelInfo[] = [
  // Claude
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", description: "Balanced speed and intelligence", contextWindow: 200000, supports1MContext: true },
  { id: "claude-opus-4-8", label: "Opus 4.8", description: "Most capable model", contextWindow: 200000, supports1MContext: true },
  { id: "claude-opus-4-6", label: "Opus 4.6", description: "Previous Opus", contextWindow: 200000, supports1MContext: true },
  { id: "claude-haiku-4-5", label: "Haiku 4.5", description: "Fast and efficient", contextWindow: 200000 },
  // Codex
  { id: "gpt-5.5", label: "GPT-5.5", description: "Latest OpenAI model", contextWindow: 1000000, supports1MContext: true },
  { id: "gpt-5.4", label: "GPT-5.4", description: "Balanced model", contextWindow: 128000 },
  { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", description: "Fast and cost-effective", contextWindow: 128000 },
  { id: "gpt-5.2-codex", label: "GPT-5.2 Codex", description: "Optimized for code", contextWindow: 128000 },
];

const DEFAULT_MODEL_MAP: Record<string, ModelInfo> = AVAILABLE_MODELS.reduce(
  (acc, model) => { acc[model.id] = model; return acc; },
  {} as Record<string, ModelInfo>,
);

// ─── 模型映射 ────────────────────────────────────────────────────────────────

const MODEL_ID_TO_MAPPING_KEY: Record<string, string> = {
  "claude-sonnet-4-6": "sonnet",
  "claude-opus-4-8": "opus",
  "claude-opus-4-6": "opus",
  "claude-haiku-4-5": "haiku",
};

function readClaudeModelMapping(): Record<string, string | undefined> {
  try {
    const raw = localStorage.getItem("claude-model-mapping");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getCustomModels(key: string): { id: string; label?: string }[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function resolveModelLabel(modelId: string, mapping: Record<string, string | undefined>): string {
  const baseModel = DEFAULT_MODEL_MAP[modelId];
  if (baseModel) return baseModel.label;

  // 检查是否是 1M 后缀的模型
  const stripped = strip1MContextSuffix(modelId);
  const baseStripped = DEFAULT_MODEL_MAP[stripped];
  if (baseStripped) {
    return `${baseStripped.label} (1M)`;
  }

  // 检查映射
  const mappingKey = MODEL_ID_TO_MAPPING_KEY[stripped] || MODEL_ID_TO_MAPPING_KEY[modelId];
  if (mappingKey) {
    const mapped = mapping[mappingKey] || mapping.main;
    if (mapped) return mapped;
  }

  // 自定义模型
  const customClaude = getCustomModels("claude-custom-models");
  const customCodex = getCustomModels("codex-custom-models");
  const custom = [...customClaude, ...customCodex].find(m => m.id === modelId);
  if (custom) return custom.label || custom.id;

  return modelId;
}

function resolveModelDescription(modelId: string): string | undefined {
  const base = strip1MContextSuffix(modelId);
  return DEFAULT_MODEL_MAP[base]?.description;
}

// ─── 样式 ────────────────────────────────────────────────────────────────────

const RELATIVE_INLINE_BLOCK_STYLE: React.CSSProperties = { position: "relative", display: "inline-block" };
const CHEVRON_ICON_STYLE: React.CSSProperties = { fontSize: "10px", marginLeft: "2px" };

const DROPDOWN_STYLE: React.CSSProperties = {
  position: "absolute",
  bottom: "100%",
  left: 0,
  marginBottom: "4px",
  zIndex: 10000,
  minWidth: "260px",
  maxHeight: "400px",
  overflowY: "auto",
  background: "var(--cc-bg-dropdown, #2b2b2b)",
  border: "1px solid var(--cc-border, #555)",
  borderRadius: "6px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
};

const OPTION_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 12px",
  cursor: "pointer",
};

const MODEL_OPTION_INFO_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minWidth: 0,
};

const DIVIDER_STYLE: React.CSSProperties = {
  height: 1,
  background: "var(--cc-border, #555)",
  margin: "4px 0",
  opacity: 0.5,
};

const LONG_CONTEXT_OPTION_STYLE: React.CSSProperties = {
  ...OPTION_STYLE,
  justifyContent: "space-between",
  cursor: "default",
};

const BUTTON_STYLE: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "4px",
  padding: "2px 6px",
  borderRadius: "4px",
  color: "var(--cc-text-secondary, #888)",
};

// ─── 组件 ────────────────────────────────────────────────────────────────────

export function ModelSelect({
  value,
  onChange,
  currentProvider = "claude",
  onAddModel,
  longContextEnabled = true,
  onLongContextChange,
}: ModelSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [modelMapping, setModelMapping] = useState<Record<string, string | undefined>>({});

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 加载模型映射
  useEffect(() => {
    setModelMapping(readClaudeModelMapping());
  }, [isOpen]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  }, [isOpen]);

  const handleSelect = useCallback((modelId: string) => {
    onChange(modelId);
    sendBridgeEventQuiet("set_model", modelId);
    setIsOpen(false);
  }, [onChange]);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // 获取当前 provider 的模型列表
  const getModelsForProvider = useCallback((): ModelInfo[] => {
    if (currentProvider === "codex") {
      const custom = getCustomModels("codex-custom-models").map(m => ({
        id: m.id,
        label: m.label || m.id,
      } as ModelInfo));
      return [...AVAILABLE_MODELS.filter(m => m.id.startsWith("gpt")), ...custom];
    }

    const custom = getCustomModels("claude-custom-models").map(m => ({
      id: m.id,
      label: m.label || m.id,
    } as ModelInfo));
    return [...AVAILABLE_MODELS.filter(m => m.id.startsWith("claude")), ...custom];
  }, [currentProvider]);

  const models = getModelsForProvider();
  const currentLabel = resolveModelLabel(value, modelMapping);
  const currentDescription = resolveModelDescription(value);
  const is1MModel = has1MContextSuffix(value) || DEFAULT_MODEL_MAP[strip1MContextSuffix(value)]?.supports1MContext;

  const renderModelOption = (model: ModelInfo) => {
    const isSelected = normalizeClaudeModelId(model.id) === normalizeClaudeModelId(value);
    const label = resolveModelLabel(model.id, modelMapping);
    const description = model.description;

    return (
      <div
        key={model.id}
        className={`selector-option ${isSelected ? "selected" : ""}`}
        style={OPTION_STYLE}
        onClick={(e) => {
          e.stopPropagation();
          // 如果支持 1M 且当前开启了长上下文，附加后缀
          const modelToSet = model.supports1MContext && longContextEnabled && currentProvider === "claude"
            ? apply1MContextSuffix(model.id, longContextEnabled)
            : model.id;
          handleSelect(modelToSet);
        }}
      >
        <ProviderModelIcon providerId={currentProvider} size={16} colored />
        <div style={MODEL_OPTION_INFO_STYLE}>
          <span>{label}</span>
          {description && (
            <span style={{ fontSize: "11px", opacity: 0.6 }}>{description}</span>
          )}
        </div>
        {isSelected && <span>✓</span>}
      </div>
    );
  };

  return (
    <div style={RELATIVE_INLINE_BLOCK_STYLE}>
      <button
        ref={buttonRef}
        className="selector-button"
        onClick={handleToggle}
        style={BUTTON_STYLE}
        title={currentDescription || currentLabel}
      >
        <ProviderModelIcon providerId={currentProvider} size={12} />
        <span>{currentLabel}</span>
        {is1MModel && longContextEnabled && (
          <span style={{ fontSize: "10px", opacity: 0.7, marginLeft: "2px" }}>1M</span>
        )}
        <span style={CHEVRON_ICON_STYLE}>{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div ref={dropdownRef} className="selector-dropdown" style={DROPDOWN_STYLE}>
          {/* 模型列表 */}
          {models.map(renderModelOption)}

          {/* 1M 上下文开关（仅 Claude） */}
          {currentProvider === "claude" && is1MModel && (
            <>
              <div style={DIVIDER_STYLE} />
              <div style={LONG_CONTEXT_OPTION_STYLE}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>📏</span>
                  <span style={{ fontSize: "12px" }}>{t("settings.basic.longContext")}</span>
                </div>
                <input
                  type="checkbox"
                  checked={longContextEnabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    onLongContextChange?.(e.target.checked);
                    // 如果当前模型支持 1M，切换时更新模型 ID
                    const currentBase = strip1MContextSuffix(value);
                    const newModel = apply1MContextSuffix(currentBase, e.target.checked);
                    if (newModel !== value) {
                      handleSelect(newModel);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </>
          )}

          {/* 添加自定义模型 */}
          {onAddModel && (
            <>
              <div style={DIVIDER_STYLE} />
              <div
                className="selector-option"
                style={OPTION_STYLE}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddModel();
                  setIsOpen(false);
                }}
              >
                <span>➕</span>
                <span>{t("settings.basic.addCustomModel")}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
