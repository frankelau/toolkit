// PromptSection/index.tsx — Prompt 模板管理区
// 对齐 cc-gui 的 PromptSection/index.tsx
// 整合 PromptScopeSection + PromptDialog + 导入导出弹窗

import { useLocale } from "../../../hooks/useLocale";
import { useState, useEffect, useCallback } from "react";
import type { PromptTemplate } from "../../../types";
import { uid } from "../../../constants";
import PromptScopeSection from "./PromptScopeSection";
import type { PromptScope } from "./PromptScopeSection";
import PromptDialog from "../../PromptDialog";
import { ConfirmDialog } from "../../common";
import PromptExportDialog from "./PromptExportDialog";
import PromptImportConfirmDialog, { type PromptImportPreview, type ConflictStrategy } from "./PromptImportConfirmDialog";

const GLOBAL_STORAGE_KEY = "ccagent:globalPrompts";
const PROJECT_STORAGE_KEY = "ccagent:projectPrompts";

interface PromptSectionProps {
  /** 项目路径（用于项目级 Prompt） */
  projectPath?: string;
  onSuccess?: (message: string) => void;
}

function loadPrompts(key: string): PromptTemplate[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePrompts(key: string, prompts: PromptTemplate[]) {
  localStorage.setItem(key, JSON.stringify(prompts));
}

export default function PromptSection({ projectPath, onSuccess }: PromptSectionProps) {
  const { t } = useLocale();
  const [globalPrompts, setGlobalPrompts] = useState<PromptTemplate[]>([]);
  const [projectPrompts, setProjectPrompts] = useState<PromptTemplate[]>([]);
  const [promptDialog, setPromptDialog] = useState<{ isOpen: boolean; prompt: PromptTemplate | null; scope: PromptScope }>({
    isOpen: false,
    prompt: null,
    scope: "global",
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; prompt: PromptTemplate; scope: PromptScope } | null>(null);
  const [exportDialog, setExportDialog] = useState(false);
  const [importPreview, setImportPreview] = useState<{ isOpen: boolean; data: PromptImportPreview | null }>({
    isOpen: false,
    data: null,
  });

  // 加载
  useEffect(() => {
    setGlobalPrompts(loadPrompts(GLOBAL_STORAGE_KEY));
    if (projectPath) {
      setProjectPrompts(loadPrompts(`${PROJECT_STORAGE_KEY}:${projectPath}`));
    }
  }, [projectPath]);

  const updateGlobalPrompts = useCallback((prompts: PromptTemplate[]) => {
    setGlobalPrompts(prompts);
    savePrompts(GLOBAL_STORAGE_KEY, prompts);
  }, []);

  const updateProjectPrompts = useCallback((prompts: PromptTemplate[]) => {
    setProjectPrompts(prompts);
    if (projectPath) {
      savePrompts(`${PROJECT_STORAGE_KEY}:${projectPath}`, prompts);
    }
  }, [projectPath]);

  const getPromptsByScope = (scope: PromptScope) => scope === "global" ? globalPrompts : projectPrompts;
  const updateByScope = (scope: PromptScope, prompts: PromptTemplate[]) =>
    scope === "global" ? updateGlobalPrompts(prompts) : updateProjectPrompts(prompts);

  // 新建
  const handleAdd = (scope: PromptScope) => {
    setPromptDialog({ isOpen: true, prompt: null, scope });
  };

  // 编辑
  const handleEdit = (scope: PromptScope, prompt: PromptTemplate) => {
    setPromptDialog({ isOpen: true, prompt, scope });
  };

  // 保存（新建或更新）
  const handleSavePrompt = (data: { name: string; content: string }) => {
    const { prompt, scope } = promptDialog;
    const prompts = getPromptsByScope(scope);
    if (prompt) {
      // 更新
      const updated = prompts.map(p => p.id === prompt.id ? { ...p, ...data, modified: Date.now() } : p);
      updateByScope(scope, updated);
      onSuccess?.("Prompt 模板已更新");
    } else {
      // 新建
      const newPrompt: PromptTemplate = { id: uid(), ...data, modified: Date.now() };
      updateByScope(scope, [...prompts, newPrompt]);
      onSuccess?.("Prompt 模板已创建");
    }
    setPromptDialog(prev => ({ ...prev, isOpen: false }));
  };

  // 删除
  const handleDelete = (scope: PromptScope, prompt: PromptTemplate) => {
    setDeleteConfirm({ isOpen: true, prompt, scope });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    const { prompt, scope } = deleteConfirm;
    const updated = getPromptsByScope(scope).filter(p => p.id !== prompt.id);
    updateByScope(scope, updated);
    onSuccess?.("Prompt 模板已删除");
    setDeleteConfirm(null);
  };

  // 使用模板
  const handleUse = (prompt: PromptTemplate) => {
    // 触发自定义事件，由输入框组件监听
    window.dispatchEvent(new CustomEvent("ccagent:usePrompt", { detail: prompt.content }));
    onSuccess?.(`已加载模板：${prompt.name}`);
  };

  // 导出
  const handleExport = () => {
    setExportDialog(true);
  };

  const handleConfirmExport = (selectedIds: string[]) => {
    const all = [...globalPrompts, ...projectPrompts];
    const selected = all.filter(p => selectedIds.includes(p.id));
    const blob = new Blob([JSON.stringify({ version: "1.0", exportedAt: new Date().toISOString(), prompts: selected }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prompts-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportDialog(false);
    onSuccess?.(`已导出 ${selected.length} 个 Prompt 模板`);
  };

  // 导入
  const handleImportFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          const imported: PromptTemplate[] = (data.prompts || []).map((p: PromptTemplate) => ({
            id: uid(),
            name: p.name,
            content: p.content,
            modified: Date.now(),
          }));
          const all = [...globalPrompts, ...projectPrompts];
          const conflicts = imported
            .filter(ip => all.some(ep => ep.name === ip.name))
            .map(ip => ({ name: ip.name, existing: all.find(ep => ep.name === ip.name)!, imported: ip }));
          setImportPreview({ isOpen: true, data: { prompts: imported, conflicts } });
        } catch {
          onSuccess?.("导入失败：文件格式无效");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleConfirmImport = (selectedIds: string[], strategy: ConflictStrategy) => {
    if (!importPreview.data) return;
    const toImport = importPreview.data.prompts.filter(p => selectedIds.includes(p.id));
    const all = [...globalPrompts];
    for (const imp of toImport) {
      const conflictIdx = all.findIndex(p => p.name === imp.name);
      if (conflictIdx >= 0) {
        if (strategy === "skip") continue;
        if (strategy === "overwrite") {
          all[conflictIdx] = { ...all[conflictIdx], content: imp.content, modified: Date.now() };
          continue;
        }
        if (strategy === "rename") {
          imp.name = `${imp.name} (导入)`;
        }
      }
      all.push(imp);
    }
    updateGlobalPrompts(all);
    setImportPreview({ isOpen: false, data: null });
    onSuccess?.(`已导入 ${toImport.length} 个 Prompt 模板`);
  };

  const allPrompts = [...globalPrompts, ...projectPrompts];

  return (
    <div className="cc-prompt-section">
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        <button className="cc-btn cc-btn-secondary" onClick={handleExport} disabled={allPrompts.length === 0}>
          导出
        </button>
        <button className="cc-btn cc-btn-secondary" onClick={handleImportFile}>
          导入
        </button>
      </div>

      <PromptScopeSection
        scope="global"
        title={t("promptSection.promptSection.k3")}
        prompts={globalPrompts}
        onAdd={() => handleAdd("global")}
        onEdit={p => handleEdit("global", p)}
        onDelete={p => handleDelete("global", p)}
        onUse={handleUse}
      />

      <PromptScopeSection
        scope="project"
        title={t("promptSection.promptSection.k4")}
        prompts={projectPrompts}
        projectInfo={projectPath ? { name: projectPath.split("/").pop() || projectPath, path: projectPath } : null}
        onAdd={() => handleAdd("project")}
        onEdit={p => handleEdit("project", p)}
        onDelete={p => handleDelete("project", p)}
        onUse={handleUse}
      />

      <PromptDialog
        isOpen={promptDialog.isOpen}
        prompt={promptDialog.prompt}
        onClose={() => setPromptDialog(prev => ({ ...prev, isOpen: false }))}
        onSave={handleSavePrompt}
      />

      {deleteConfirm && (
        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          title={t("promptSection.promptSection.k5")}
          message={`确定要删除 Prompt 模板 "${deleteConfirm.prompt.name}" 吗？`}
          confirmText="删除"
          cancelText="取消"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      <PromptExportDialog
        isOpen={exportDialog}
        prompts={allPrompts}
        onConfirm={handleConfirmExport}
        onCancel={() => setExportDialog(false)}
      />

      <PromptImportConfirmDialog
        isOpen={importPreview.isOpen}
        previewData={importPreview.data}
        onConfirm={handleConfirmImport}
        onCancel={() => setImportPreview({ isOpen: false, data: null })}
      />
    </div>
  );
}
