// usePromptManagement — Prompt 模板管理（对齐 cc-gui usePromptManagement）
// Sprint U2: 深化实现 — 完整 CRUD + 导入/导出 + 全局/项目双作用域

import { useState, useCallback, useRef } from "react";
import { t } from "../../../i18n";
import { sendBridgeEventQuiet } from "../../../utils/bridge";
import type { PromptTemplate } from "../../../types";

// ─── 类型定义 ────────────────────────────────────────────────────────────────

export type PromptScope = "global" | "project";

export interface PromptConfig extends PromptTemplate {
  scope?: PromptScope;
}

export interface ProjectInfo {
  name: string;
  path: string;
}

export interface PromptDialogState {
  isOpen: boolean;
  prompt: PromptConfig | null;
  scope: PromptScope;
}

export interface DeletePromptConfirmState {
  isOpen: boolean;
  prompt: PromptConfig | null;
  scope: PromptScope;
}

export interface ImportPreviewDialogState {
  isOpen: boolean;
  previewData: { items: PromptConfig[]; conflicts: number } | null;
  scope: PromptScope;
}

export interface ExportDialogState {
  isOpen: boolean;
  scope: PromptScope;
}

export interface UsePromptManagementOptions {
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePromptManagement(options: UsePromptManagementOptions = {}) {
  const { onSuccess, onError } = options;

  const promptsLoadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentImportScopeRef = useRef<PromptScope>("global");

  // 双作用域列表
  const [globalPrompts, setGlobalPrompts] = useState<PromptConfig[]>([]);
  const [projectPrompts, setProjectPrompts] = useState<PromptConfig[]>([]);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [promptsLoading, setPromptsLoading] = useState(false);

  // 对话框状态
  const [promptDialog, setPromptDialog] = useState<PromptDialogState>({
    isOpen: false,
    prompt: null,
    scope: "global",
  });

  const [deletePromptConfirm, setDeletePromptConfirm] = useState<DeletePromptConfirmState>({
    isOpen: false,
    prompt: null,
    scope: "global",
  });

  const [importPreviewDialog, setImportPreviewDialog] = useState<ImportPreviewDialogState>({
    isOpen: false,
    previewData: null,
    scope: "global",
  });

  const [exportDialog, setExportDialog] = useState<ExportDialogState>({
    isOpen: false,
    scope: "global",
  });

  // 加载 Prompt 列表
  const loadPrompts = useCallback((scope: PromptScope = "global") => {
    setPromptsLoading(true);
    sendBridgeEventQuiet("get_prompts", JSON.stringify({ scope }));

    if (promptsLoadingTimeoutRef.current) {
      clearTimeout(promptsLoadingTimeoutRef.current);
    }
    promptsLoadingTimeoutRef.current = setTimeout(() => {
      setPromptsLoading(false);
    }, 5000);
  }, []);

  // 更新 Prompt 列表（由事件回调使用）
  const updatePrompts = useCallback(
    (scope: PromptScope, prompts: PromptConfig[]) => {
      if (scope === "global") {
        setGlobalPrompts(prompts);
      } else {
        setProjectPrompts(prompts);
      }
      setPromptsLoading(false);
      if (promptsLoadingTimeoutRef.current) {
        clearTimeout(promptsLoadingTimeoutRef.current);
        promptsLoadingTimeoutRef.current = null;
      }
    },
    [],
  );

  // 打开编辑对话框
  const handleEditPrompt = useCallback((prompt: PromptConfig, scope: PromptScope) => {
    setPromptDialog({ isOpen: true, prompt, scope });
  }, []);

  // 打开新增对话框
  const handleAddPrompt = useCallback((scope: PromptScope) => {
    setPromptDialog({ isOpen: true, prompt: null, scope });
  }, []);

  // 关闭对话框
  const handleClosePromptDialog = useCallback(() => {
    setPromptDialog({ isOpen: false, prompt: null, scope: "global" });
  }, []);

  // 保存 Prompt
  const handleSavePrompt = useCallback(
    (data: { name: string; content: string; description?: string }): boolean => {
      if (!data.name?.trim()) {
        onError?.(t("toast.pleaseEnterPromptName"));
        return false;
      }

      const isAdding = !promptDialog.prompt;
      const promptData = {
        id: promptDialog.prompt?.id ?? crypto.randomUUID?.() ?? Date.now().toString(),
        name: data.name.trim(),
        content: data.content,
        description: data.description,
        scope: promptDialog.scope,
      };

      if (isAdding) {
        sendBridgeEventQuiet("add_prompt", JSON.stringify(promptData));
        onSuccess?.(t("toast.promptAdded"));
      } else {
        sendBridgeEventQuiet("update_prompt", JSON.stringify(promptData));
        onSuccess?.(t("toast.promptUpdated"));
      }

      setPromptDialog({ isOpen: false, prompt: null, scope: "global" });
      return true;
    },
    [promptDialog, onError, onSuccess],
  );

  // 删除 Prompt
  const handleDeletePrompt = useCallback((prompt: PromptConfig, scope: PromptScope) => {
    setDeletePromptConfirm({ isOpen: true, prompt, scope });
  }, []);

  // 确认删除
  const confirmDeletePrompt = useCallback(() => {
    const prompt = deletePromptConfirm.prompt;
    const scope = deletePromptConfirm.scope;
    if (!prompt) return;

    sendBridgeEventQuiet("delete_prompt", JSON.stringify({ id: prompt.id, scope }));
    onSuccess?.(t("toast.promptDeleted"));
    setDeletePromptConfirm({ isOpen: false, prompt: null, scope: "global" });
  }, [deletePromptConfirm, onSuccess]);

  // 取消删除
  const cancelDeletePrompt = useCallback(() => {
    setDeletePromptConfirm({ isOpen: false, prompt: null, scope: "global" });
  }, []);

  // 导入
  const handleImportPrompts = useCallback(
    (jsonData: string, scope: PromptScope) => {
      currentImportScopeRef.current = scope;
      try {
        const data = JSON.parse(jsonData);
        const items: PromptConfig[] = Array.isArray(data) ? data : (data?.prompts ?? []);
        if (items.length === 0) return false;
        setImportPreviewDialog({ isOpen: true, previewData: { items, conflicts: 0 }, scope });
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  // 确认导入
  const confirmImportPrompts = useCallback(
    (_strategy: string) => {
      if (!importPreviewDialog.previewData) return;
      const items = importPreviewDialog.previewData.items;
      const scope = importPreviewDialog.scope;
      for (const prompt of items) {
        sendBridgeEventQuiet("add_prompt", JSON.stringify({
          ...prompt,
          id: crypto.randomUUID?.() ?? Date.now().toString(),
          scope,
        }));
      }
      onSuccess?.(t("toast.promptsImported", { count: items.length }));
      setImportPreviewDialog({ isOpen: false, previewData: null, scope: "global" });
    },
    [importPreviewDialog, onSuccess],
  );

  // 取消导入
  const cancelImportPrompts = useCallback(() => {
    setImportPreviewDialog({ isOpen: false, previewData: null, scope: "global" });
  }, []);

  // 导出
  const handleExportPrompts = useCallback((scope: PromptScope) => {
    setExportDialog({ isOpen: true, scope });
  }, []);

  // 确认导出
  const confirmExportPrompts = useCallback(
    (selectedIds: string[]) => {
      const source = exportDialog.scope === "global" ? globalPrompts : projectPrompts;
      const selected = source.filter((p) => selectedIds.includes(p.id));
      if (selected.length === 0) return;

      const exportData = JSON.stringify({ prompts: selected }, null, 2);
      const blob = new Blob([exportData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prompts-${exportDialog.scope}-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      onSuccess?.(t("toast.promptsExported", { count: selected.length }));
      setExportDialog({ isOpen: false, scope: "global" });
    },
    [exportDialog, globalPrompts, projectPrompts, onSuccess],
  );

  // 取消导出
  const cancelExportPrompts = useCallback(() => {
    setExportDialog({ isOpen: false, scope: "global" });
  }, []);

  return {
    // 状态
    globalPrompts,
    projectPrompts,
    projectInfo,
    promptsLoading,
    promptDialog,
    deletePromptConfirm,
    importPreviewDialog,
    exportDialog,

    // 方法
    loadPrompts,
    updatePrompts,
    setProjectInfo,
    handleEditPrompt,
    handleAddPrompt,
    handleClosePromptDialog,
    handleSavePrompt,
    handleDeletePrompt,
    confirmDeletePrompt,
    cancelDeletePrompt,
    handleImportPrompts,
    confirmImportPrompts,
    cancelImportPrompts,
    handleExportPrompts,
    confirmExportPrompts,
    cancelExportPrompts,
  };
}

export type UsePromptManagementReturn = ReturnType<typeof usePromptManagement>;
