// useAgentManagement — Agent 管理（对齐 cc-gui useAgentManagement）
// Sprint U2: 深化实现 — 完整 CRUD + 导入/导出 + 删除确认

import { useState, useCallback, useRef } from "react";
import { t } from "../../../i18n";
import { sendBridgeEventQuiet } from "../../../utils/bridge";
import type { AgentConfig } from "../../../types";

// ─── 类型定义 ────────────────────────────────────────────────────────────────

export interface AgentDialogState {
  isOpen: boolean;
  agent: AgentConfig | null;
}

export interface DeleteAgentConfirmState {
  isOpen: boolean;
  agent: AgentConfig | null;
}

export interface ImportPreviewDialogState {
  isOpen: boolean;
  previewData: { items: AgentConfig[]; conflicts: number } | null;
}

export interface ExportDialogState {
  isOpen: boolean;
}

export interface UseAgentManagementOptions {
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAgentManagement(options: UseAgentManagementOptions = {}) {
  const { onSuccess } = options;

  const agentsLoadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Agent 列表状态
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  // Agent 对话框状态
  const [agentDialog, setAgentDialog] = useState<AgentDialogState>({
    isOpen: false,
    agent: null,
  });

  // 删除确认状态
  const [deleteAgentConfirm, setDeleteAgentConfirm] = useState<DeleteAgentConfirmState>({
    isOpen: false,
    agent: null,
  });

  // 导入预览对话框状态
  const [importPreviewDialog, setImportPreviewDialog] = useState<ImportPreviewDialogState>({
    isOpen: false,
    previewData: null,
  });

  // 导出对话框状态
  const [exportDialog, setExportDialog] = useState<ExportDialogState>({
    isOpen: false,
  });

  // 加载 Agent 列表
  const loadAgents = useCallback(() => {
    setAgentsLoading(true);
    sendBridgeEventQuiet("get_agents");

    // 超时保护
    if (agentsLoadingTimeoutRef.current) {
      clearTimeout(agentsLoadingTimeoutRef.current);
    }
    agentsLoadingTimeoutRef.current = setTimeout(() => {
      setAgentsLoading(false);
    }, 5000);
  }, []);

  // 更新 Agent 列表（由事件回调使用）
  const updateAgents = useCallback((agentList: AgentConfig[]) => {
    setAgents(agentList);
    setAgentsLoading(false);
    if (agentsLoadingTimeoutRef.current) {
      clearTimeout(agentsLoadingTimeoutRef.current);
      agentsLoadingTimeoutRef.current = null;
    }
  }, []);

  // 打开编辑对话框
  const handleEditAgent = useCallback((agent: AgentConfig) => {
    setAgentDialog({ isOpen: true, agent });
  }, []);

  // 打开新增对话框
  const handleAddAgent = useCallback(() => {
    setAgentDialog({ isOpen: true, agent: null });
  }, []);

  // 关闭对话框
  const handleCloseAgentDialog = useCallback(() => {
    setAgentDialog({ isOpen: false, agent: null });
  }, []);

  // 保存 Agent
  const handleSaveAgent = useCallback(
    (data: { name: string; prompt: string; description?: string }): boolean => {
      if (!data.name?.trim()) {
        return false;
      }

      const isAdding = !agentDialog.agent;
      const agentData = {
        id: agentDialog.agent?.id ?? crypto.randomUUID?.() ?? Date.now().toString(),
        name: data.name.trim(),
        prompt: data.prompt,
        description: data.description,
      };

      if (isAdding) {
        sendBridgeEventQuiet("add_agent", JSON.stringify(agentData));
        onSuccess?.(t("toast.agentAdded"));
      } else {
        sendBridgeEventQuiet("update_agent", JSON.stringify(agentData));
        onSuccess?.(t("toast.agentUpdated"));
      }

      setAgentDialog({ isOpen: false, agent: null });
      return true;
    },
    [agentDialog.agent, onSuccess],
  );

  // 删除 Agent
  const handleDeleteAgent = useCallback((agent: AgentConfig) => {
    setDeleteAgentConfirm({ isOpen: true, agent });
  }, []);

  // 确认删除
  const confirmDeleteAgent = useCallback(() => {
    const agent = deleteAgentConfirm.agent;
    if (!agent) return;

    sendBridgeEventQuiet("delete_agent", JSON.stringify({ id: agent.id }));
    onSuccess?.(t("toast.agentDeleted"));
    setDeleteAgentConfirm({ isOpen: false, agent: null });
  }, [deleteAgentConfirm.agent, onSuccess]);

  // 取消删除
  const cancelDeleteAgent = useCallback(() => {
    setDeleteAgentConfirm({ isOpen: false, agent: null });
  }, []);

  // 导入 Agent
  const handleImportAgents = useCallback((jsonData: string) => {
    try {
      const data = JSON.parse(jsonData);
      const items: AgentConfig[] = Array.isArray(data) ? data : (data?.agents ?? []);
      if (items.length === 0) {
        return false;
      }
      setImportPreviewDialog({ isOpen: true, previewData: { items, conflicts: 0 } });
      return true;
    } catch {
      return false;
    }
  }, []);

  // 确认导入
  const confirmImportAgents = useCallback(
    (_strategy: string) => {
      if (!importPreviewDialog.previewData) return;
      const items = importPreviewDialog.previewData.items;
      for (const agent of items) {
        sendBridgeEventQuiet("add_agent", JSON.stringify({
          ...agent,
          id: crypto.randomUUID?.() ?? Date.now().toString(),
        }));
      }
      onSuccess?.(t("toast.agentsImported", { count: items.length }));
      setImportPreviewDialog({ isOpen: false, previewData: null });
    },
    [importPreviewDialog.previewData, onSuccess],
  );

  // 取消导入
  const cancelImportAgents = useCallback(() => {
    setImportPreviewDialog({ isOpen: false, previewData: null });
  }, []);

  // 导出 Agent
  const handleExportAgents = useCallback(() => {
    setExportDialog({ isOpen: true });
  }, []);

  // 确认导出
  const confirmExportAgents = useCallback(
    (selectedIds: string[]) => {
      const selected = agents.filter((a) => selectedIds.includes(a.id));
      if (selected.length === 0) return;

      const exportData = JSON.stringify({ agents: selected }, null, 2);
      const blob = new Blob([exportData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agents-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      onSuccess?.(t("toast.agentsExported", { count: selected.length }));
      setExportDialog({ isOpen: false });
    },
    [agents, onSuccess],
  );

  // 取消导出
  const cancelExportAgents = useCallback(() => {
    setExportDialog({ isOpen: false });
  }, []);

  return {
    // 状态
    agents,
    agentsLoading,
    agentDialog,
    deleteAgentConfirm,
    importPreviewDialog,
    exportDialog,

    // 方法
    loadAgents,
    updateAgents,
    handleEditAgent,
    handleAddAgent,
    handleCloseAgentDialog,
    handleSaveAgent,
    handleDeleteAgent,
    confirmDeleteAgent,
    cancelDeleteAgent,
    handleImportAgents,
    confirmImportAgents,
    cancelImportAgents,
    handleExportAgents,
    confirmExportAgents,
    cancelExportAgents,
  };
}

export type UseAgentManagementReturn = ReturnType<typeof useAgentManagement>;
