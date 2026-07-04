// ProviderDialog — Provider 配置弹窗（对齐 cc-gui ProviderDialog）
// Sprint D: 添加/编辑自定义 Provider

import { useState, useEffect } from "react";
import type { ProviderPreset } from "../../types";

interface ProviderDialogProps {
  isOpen: boolean;
  preset: ProviderPreset | null;
  onSave: (preset: ProviderPreset) => void;
  onClose: () => void;
}

export function ProviderDialog({ isOpen, preset, onSave, onClose }: ProviderDialogProps) {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState("");

  useEffect(() => {
    if (preset) {
      setName(preset.name);
      setBaseUrl(preset.baseUrl || "");
      setApiKey(preset.apiKey || "");
      setModels((preset.customModels || []).map(m => `${m.value}:${m.label}`).join("\n"));
    } else {
      setName(""); setBaseUrl(""); setApiKey(""); setModels("");
    }
  }, [preset, isOpen]);

  if (!isOpen) return null;

  function save() {
    const customModels = models.trim()
      .split("\n")
      .filter(Boolean)
      .map(line => {
        const [value, label] = line.split(":");
        return { value: value?.trim() || "", label: (label?.trim() || value?.trim() || "") };
      })
      .filter(m => m.value);

    onSave({
      id: preset?.id || `custom-${Date.now()}`,
      name: name.trim() || "自定义",
      baseUrl: baseUrl.trim() || undefined,
      apiKey: apiKey.trim() || undefined,
      customModels: customModels.length > 0 ? customModels : undefined,
    });
  }

  return (
    <div className="cc-mcp-dialog-overlay" onClick={onClose}>
      <div className="cc-mcp-dialog" onClick={e => e.stopPropagation()}>
        <div className="cc-mcp-dialog-title">{preset ? "编辑 Provider" : "添加 Provider"}</div>

        <div className="cc-mcp-field">
          <label>名称</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="如：我的 API" autoFocus />
        </div>
        <div className="cc-mcp-field">
          <label>Base URL</label>
          <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.example.com/anthropic" />
        </div>
        <div className="cc-mcp-field">
          <label>API Key</label>
          <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." />
        </div>
        <div className="cc-mcp-field">
          <label>自定义模型（每行一个，格式 value:label）</label>
          <textarea
            value={models}
            onChange={e => setModels(e.target.value)}
            rows={4}
            placeholder={"my-model-v1:我的模型 V1\nmy-model-v2:我的模型 V2"}
          />
        </div>

        <div className="cc-mcp-dialog-actions">
          <button className="cc-mcp-cancel" onClick={onClose}>取消</button>
          <button className="cc-mcp-save" onClick={save} disabled={!name.trim()}>保存</button>
        </div>
      </div>
    </div>
  );
}
