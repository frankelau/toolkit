// useProviderManagement — Provider 管理（对齐 cc-gui useProviderManagement）
// Sprint U2: 深化实现 — 完整 CRUD + 模型映射同步 + 切换/删除/编辑

import { useState, useCallback } from "react";
import { t } from "../../../i18n";
import { sendBridgeEventQuiet } from "../../../utils/bridge";

// ─── 类型定义 ────────────────────────────────────────────────────────────────

export interface ProviderConfig {
  id: string;
  name: string;
  remark?: string;
  websiteUrl?: string | null;
  settingsConfig?: {
    env?: Record<string, unknown>;
    [key: string]: unknown;
  };
  isActive?: boolean;
}

export interface ProviderDialogState {
  isOpen: boolean;
  provider: ProviderConfig | null;
}

export interface DeleteConfirmState {
  isOpen: boolean;
  provider: ProviderConfig | null;
}

export interface UseProviderManagementOptions {
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}

// ─── 模型映射同步 ────────────────────────────────────────────────────────────

function writeClaudeModelMapping(mapping: Record<string, string>): void {
  try {
    localStorage.setItem("claude-model-mapping", JSON.stringify(mapping));
  } catch {
    // localStorage 不可用 — 静默忽略
  }
}

function syncActiveProviderModelMapping(provider?: ProviderConfig | null): void {
  if (!provider || !provider.settingsConfig || !provider.settingsConfig.env) {
    writeClaudeModelMapping({});
    return;
  }
  const env = provider.settingsConfig.env as Record<string, unknown>;
  const get = (key: string): string =>
    typeof env[key] === "string" ? (env[key] as string) : "";
  const mapping = {
    main: get("ANTHROPIC_MODEL"),
    haiku: get("ANTHROPIC_DEFAULT_HAIKU_MODEL"),
    sonnet: get("ANTHROPIC_DEFAULT_SONNET_MODEL"),
    opus: get("ANTHROPIC_DEFAULT_OPUS_MODEL"),
  };
  writeClaudeModelMapping(mapping);
}

// ─── 特殊 Provider ID ────────────────────────────────────────────────────────

export const SPECIAL_PROVIDER_IDS = {
  DISABLED: "disabled",
  OFFICIAL: "official",
} as const;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useProviderManagement(options: UseProviderManagementOptions = {}) {
  const { onError, onSuccess } = options;

  // Provider 列表状态
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(false);

  // Provider 对话框状态
  const [providerDialog, setProviderDialog] = useState<ProviderDialogState>({
    isOpen: false,
    provider: null,
  });

  // 删除确认对话框状态
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
    isOpen: false,
    provider: null,
  });

  // 加载 Provider 列表
  const loadProviders = useCallback(() => {
    setLoading(true);
    sendBridgeEventQuiet("get_providers");
  }, []);

  // 更新 Provider 列表（由事件回调使用）
  const updateProviders = useCallback((providersList: ProviderConfig[]) => {
    setProviders(providersList);
    const active = providersList.find((p) => p.isActive);
    if (active) {
      syncActiveProviderModelMapping(active);
    } else {
      syncActiveProviderModelMapping(null);
    }
    setLoading(false);
  }, []);

  // 更新活跃 Provider（由事件回调使用）
  const updateActiveProvider = useCallback((activeProvider: ProviderConfig) => {
    if (activeProvider) {
      setProviders((prev) =>
        prev.map((p) => ({ ...p, isActive: p.id === activeProvider.id })),
      );
      syncActiveProviderModelMapping(activeProvider);
    }
  }, []);

  // 打开编辑对话框
  const handleEditProvider = useCallback((provider: ProviderConfig) => {
    setProviderDialog({ isOpen: true, provider });
  }, []);

  // 打开新增对话框
  const handleAddProvider = useCallback(() => {
    setProviderDialog({ isOpen: true, provider: null });
  }, []);

  // 关闭对话框
  const handleCloseProviderDialog = useCallback(() => {
    setProviderDialog({ isOpen: false, provider: null });
  }, []);

  // 保存 Provider
  const handleSaveProvider = useCallback(
    (data: {
      providerName: string;
      remark: string;
      apiKey: string;
      apiUrl: string;
      jsonConfig: string;
    }): boolean => {
      if (!data.providerName) {
        onError?.(t("toast.pleaseEnterProviderName"));
        return false;
      }

      let parsedConfig: Record<string, unknown>;
      try {
        parsedConfig = JSON.parse(data.jsonConfig || "{}");
      } catch {
        onError?.(t("toast.invalidJsonConfig"));
        return false;
      }

      const updates = {
        name: data.providerName,
        remark: data.remark,
        websiteUrl: null,
        settingsConfig: parsedConfig,
      };

      const isAdding = !providerDialog.provider;

      if (isAdding) {
        const newProvider: ProviderConfig = {
          id: crypto.randomUUID?.() ?? Date.now().toString(),
          ...updates,
        };
        sendBridgeEventQuiet("add_provider", JSON.stringify(newProvider));
        onSuccess?.(t("toast.providerAdded"));
      } else {
        if (!providerDialog.provider) return false;

        const providerId = providerDialog.provider.id;
        const currentProvider =
          providers.find((p) => p.id === providerId) || providerDialog.provider;
        const isActive = currentProvider.isActive;

        const updateData = { id: providerId, updates };
        sendBridgeEventQuiet("update_provider", JSON.stringify(updateData));
        onSuccess?.(t("toast.providerUpdated"));

        if (isActive) {
          syncActiveProviderModelMapping({
            ...currentProvider,
            settingsConfig: parsedConfig as ProviderConfig["settingsConfig"],
          });
          setTimeout(() => {
            sendBridgeEventQuiet("switch_provider", JSON.stringify({ id: providerId }));
          }, 100);
        }
      }

      setProviderDialog({ isOpen: false, provider: null });
      setLoading(true);
      return true;
    },
    [providerDialog.provider, providers, onError, onSuccess],
  );

  // 切换 Provider
  const handleSwitchProvider = useCallback(
    (id: string) => {
      const data = { id };
      if (id === SPECIAL_PROVIDER_IDS.DISABLED) {
        syncActiveProviderModelMapping(null);
        sendBridgeEventQuiet("switch_provider", JSON.stringify(data));
        setLoading(true);
        return;
      }
      const target = providers.find((p) => p.id === id);
      if (target) {
        syncActiveProviderModelMapping(target);
      }
      sendBridgeEventQuiet("switch_provider", JSON.stringify(data));
      setLoading(true);
    },
    [providers],
  );

  // 删除 Provider
  const handleDeleteProvider = useCallback((provider: ProviderConfig) => {
    setDeleteConfirm({ isOpen: true, provider });
  }, []);

  // 确认删除
  const confirmDeleteProvider = useCallback(() => {
    const provider = deleteConfirm.provider;
    if (!provider) return;

    const data = { id: provider.id };
    sendBridgeEventQuiet("delete_provider", JSON.stringify(data));
    onSuccess?.(t("toast.providerDeleted"));
    setLoading(true);
    setDeleteConfirm({ isOpen: false, provider: null });
  }, [deleteConfirm.provider, onSuccess]);

  // 取消删除
  const cancelDeleteProvider = useCallback(() => {
    setDeleteConfirm({ isOpen: false, provider: null });
  }, []);

  return {
    // 状态
    providers,
    loading,
    providerDialog,
    deleteConfirm,

    // 方法
    loadProviders,
    updateProviders,
    updateActiveProvider,
    handleEditProvider,
    handleAddProvider,
    handleCloseProviderDialog,
    handleSaveProvider,
    handleSwitchProvider,
    handleDeleteProvider,
    confirmDeleteProvider,
    cancelDeleteProvider,
    syncActiveProviderModelMapping: (provider?: ProviderConfig | null) =>
      syncActiveProviderModelMapping(provider),

    // Setter（用于外部加载状态控制）
    setLoading,
  };
}

export type UseProviderManagementReturn = ReturnType<typeof useProviderManagement>;
