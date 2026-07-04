// ProviderManageSection/index.tsx — Provider 管理区
// 对齐 cc-gui 的 ProviderManageSection/index.tsx
// 整合 ProviderList + ProviderDialog，提供完整的 Provider 管理流程

import { useState, useEffect, useCallback } from "react";
import type { ProviderPreset } from "../../../types";
import { ProviderList } from "../ProviderList";
import { ProviderDialog } from "../ProviderDialog";
import { AddIcon } from "../../Icons";
import { SECTION_TITLE_STYLE, BUTTON_STYLE, DESCRIPTION_STYLE } from "../shared";

const STORAGE_KEY = "ccagent:providers";
const ACTIVE_KEY = "ccagent:activeProvider";

interface ProviderManageSectionProps {
  /** 当前活跃 Provider ID */
  activeProviderId?: string;
  /** 切换 Provider 回调 */
  onSwitchProvider?: (providerId: string) => void;
  /** Toast 回调 */
  addToast?: (message: string, type: "success" | "error" | "info") => void;
}

export default function ProviderManageSection({
  activeProviderId,
  onSwitchProvider,
  addToast,
}: ProviderManageSectionProps) {
  const [providers, setProviders] = useState<ProviderPreset[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderPreset | null>(null);

  // 加载
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setProviders(raw ? JSON.parse(raw) : []);
    } catch {
      setProviders([]);
    }
  }, []);

  const saveProviders = useCallback((list: ProviderPreset[]) => {
    setProviders(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }, []);

  const handleAdd = () => {
    setEditingProvider(null);
    setDialogOpen(true);
  };

  const handleEdit = (provider: ProviderPreset) => {
    setEditingProvider(provider);
    setDialogOpen(true);
  };

  const handleSave = (preset: ProviderPreset) => {
    if (editingProvider) {
      // 更新
      const updated = providers.map(p =>
        p.id === editingProvider.id ? { ...preset, id: editingProvider.id } : p,
      );
      saveProviders(updated);
      addToast?.("Provider 已更新", "success");
    } else {
      // 新建
      saveProviders([...providers, preset]);
      addToast?.("Provider 已创建", "success");
    }
    setDialogOpen(false);
  };

  const handleSwitch = (providerId: string) => {
    localStorage.setItem(ACTIVE_KEY, providerId);
    onSwitchProvider?.(providerId);
    const provider = providers.find(p => p.id === providerId);
    addToast?.(`已切换到 ${provider?.name || providerId}`, "info");
  };

  return (
    <div className="cc-provider-manage-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h4 style={{ ...SECTION_TITLE_STYLE, margin: 0, borderBottom: "none", paddingBottom: 0 }}>
          API Provider 管理
          <span style={{ marginLeft: "8px", fontSize: "11px", color: "var(--text-muted, #888)" }}>
            ({providers.length})
          </span>
        </h4>
        <button style={{ ...BUTTON_STYLE, display: "inline-flex", alignItems: "center", gap: "4px" }} onClick={handleAdd}>
          <AddIcon size={14} />
          添加 Provider
        </button>
      </div>

      <div style={DESCRIPTION_STYLE}>
        管理 Claude Code 的 API Provider 配置。切换 Provider 后会立即生效。
      </div>

      <ProviderList
        presets={providers}
        selectedId={activeProviderId || ""}
        onSelect={handleSwitch}
        onEdit={handleEdit}
        onAdd={handleAdd}
      />

      <ProviderDialog
        isOpen={dialogOpen}
        preset={editingProvider}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
