// ProviderTabSection — Provider 标签页（对齐 cc-gui ProviderTabSection）
// Sprint D: Provider 列表 + 管理 + 添加自定义

import { useState } from "react";
import type { ProviderPreset } from "../../../types";
import { PROVIDER_PRESETS } from "../../../constants";
import { ProviderList } from "../ProviderList";
import { ProviderDialog } from "../ProviderDialog";

interface ProviderTabSectionProps {
  providerId: string;
  setProviderId: (id: string) => void;
  providerBaseUrl: string;
  setProviderBaseUrl: (url: string) => void;
  providerApiKey: string;
  setProviderApiKey: (key: string) => void;
  model: string;
  setModel: (m: string) => void;
}

export function ProviderTabSection(props: ProviderTabSectionProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingPreset, setEditingPreset] = useState<ProviderPreset | null>(null);

  const currentPreset = PROVIDER_PRESETS.find(p => p.id === props.providerId);

  function handleEdit(preset: ProviderPreset) {
    setEditingPreset(preset);
    setShowDialog(true);
  }

  function handleSave(preset: ProviderPreset) {
    // 这里只更新当前选中（简化版，不做持久化预设管理）
    if (preset.id === props.providerId || editingPreset?.id === props.providerId) {
      props.setProviderBaseUrl(preset.baseUrl || "");
      if (preset.apiKey) props.setProviderApiKey(preset.apiKey);
    }
    setShowDialog(false);
    setEditingPreset(null);
  }

  return (
    <div className="cc-settings-block">
      <div className="cc-settings-block-title">Claude Provider 管理</div>
      <ProviderList
        presets={PROVIDER_PRESETS}
        selectedId={props.providerId}
        onSelect={props.setProviderId}
        onEdit={handleEdit}
        onAdd={() => { setEditingPreset(null); setShowDialog(true); }}
      />

      {currentPreset && currentPreset.id !== "official" && currentPreset.id !== "custom" && (
        <div className="cc-setting-row">
          <label>Base URL</label>
          <input value={props.providerBaseUrl} onChange={e => props.setProviderBaseUrl(e.target.value)} placeholder={currentPreset.baseUrl || ""} />
        </div>
      )}
      <div className="cc-setting-row">
        <label>API Key</label>
        <input type="password" value={props.providerApiKey} onChange={e => props.setProviderApiKey(e.target.value)} placeholder="sk-..." />
      </div>

      <ProviderDialog
        isOpen={showDialog}
        preset={editingPreset}
        onSave={handleSave}
        onClose={() => { setShowDialog(false); setEditingPreset(null); }}
      />
    </div>
  );
}
