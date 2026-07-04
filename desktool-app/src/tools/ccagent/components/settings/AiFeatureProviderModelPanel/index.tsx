// AiFeatureProviderModelPanel/index.tsx — AI 功能 Provider/Model 选择面板
// 对齐 cc-gui 的 AiFeatureProviderModelPanel/index.tsx
// 用于 Prompt 增强、提交信息生成等 AI 功能的独立 Provider/Model 配置

import { useState, useEffect } from "react";
import { ProviderModelIcon } from "../../shared/ProviderModelIcon";
import { SECTION_TITLE_STYLE, FORM_ROW_STYLE, LABEL_STYLE, VALUE_CONTAINER_STYLE, DESCRIPTION_STYLE, SELECT_STYLE } from "../shared";

export interface AiFeatureConfig {
  enabled: boolean;
  providerId?: string;
  modelId?: string;
  useDefault?: boolean;
}

interface AiFeatureProviderModelPanelProps {
  title: string;
  description?: string;
  config: AiFeatureConfig;
  onChange: (config: AiFeatureConfig) => void;
  /** 可用 Provider 列表 */
  providers: { id: string; name: string; models: { value: string; label: string }[] }[];
  /** 默认 Provider ID */
  defaultProviderId?: string;
  /** 默认模型 ID */
  defaultModelId?: string;
}

export default function AiFeatureProviderModelPanel({
  title,
  description,
  config,
  onChange,
  providers,
  defaultProviderId,
  defaultModelId,
}: AiFeatureProviderModelPanelProps) {
  const [useDefault, setUseDefault] = useState(config.useDefault ?? true);

  useEffect(() => {
    setUseDefault(config.useDefault ?? true);
  }, [config.useDefault]);

  const handleToggleDefault = (checked: boolean) => {
    setUseDefault(checked);
    onChange({
      ...config,
      useDefault: checked,
      providerId: checked ? defaultProviderId : config.providerId,
      modelId: checked ? defaultModelId : config.modelId,
    });
  };

  const handleProviderChange = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    const firstModel = provider?.models[0]?.value;
    onChange({ ...config, providerId, modelId: firstModel, useDefault: false });
  };

  const handleModelChange = (modelId: string) => {
    onChange({ ...config, modelId, useDefault: false });
  };

  const currentProvider = providers.find(p => p.id === (useDefault ? defaultProviderId : config.providerId));
  const currentModelId = useDefault ? defaultModelId : config.modelId;

  return (
    <div className="cc-ai-feature-panel">
      <h4 style={SECTION_TITLE_STYLE}>{title}</h4>
      {description && <div style={DESCRIPTION_STYLE}>{description}</div>}

      {/* 使用默认 Provider/Model */}
      <div style={FORM_ROW_STYLE}>
        <label style={LABEL_STYLE}>使用默认</label>
        <div style={VALUE_CONTAINER_STYLE}>
          <label className="cc-toggle-switch">
            <input
              type="checkbox"
              checked={useDefault}
              onChange={e => handleToggleDefault(e.target.checked)}
            />
            <span className="cc-toggle-slider" />
          </label>
          <div style={DESCRIPTION_STYLE}>
            开启后使用主聊天的 Provider/Model，关闭可独立配置
          </div>
        </div>
      </div>

      {/* Provider 选择 */}
      {!useDefault && (
        <>
          <div style={FORM_ROW_STYLE}>
            <label style={LABEL_STYLE}>Provider</label>
            <div style={VALUE_CONTAINER_STYLE}>
              <select
                style={SELECT_STYLE}
                value={config.providerId || ""}
                onChange={e => handleProviderChange(e.target.value)}
              >
                <option value="">请选择 Provider</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={FORM_ROW_STYLE}>
            <label style={LABEL_STYLE}>Model</label>
            <div style={VALUE_CONTAINER_STYLE}>
              <select
                style={SELECT_STYLE}
                value={config.modelId || ""}
                onChange={e => handleModelChange(e.target.value)}
                disabled={!currentProvider}
              >
                <option value="">请选择 Model</option>
                {currentProvider?.models.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}

      {/* 当前配置预览 */}
      <div style={FORM_ROW_STYLE}>
        <label style={LABEL_STYLE}>当前配置</label>
        <div style={VALUE_CONTAINER_STYLE}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
            <ProviderModelIcon
              providerId={currentProvider?.id}
              modelId={currentModelId}
              size={16}
              colored
            />
            <span>{currentProvider?.name || "未配置"}</span>
            {currentModelId && <span style={{ color: "var(--text-muted, #888)" }}>· {currentModelId}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
