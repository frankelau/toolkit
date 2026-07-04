// SettingsDialogs.tsx — 设置弹窗编排组件
// 对齐 cc-gui 的 SettingsDialogs.tsx
// 统一渲染设置页所有弹窗（Alert / Confirm / Provider / Agent / Prompt / Codex）

import type { ReactNode } from "react";
import { AlertDialog, type AlertType } from "../AlertDialog";
import { ConfirmDialog } from "../common";
import { ProviderDialog } from "./ProviderDialog";
import AgentDialog from "../AgentDialog";
import CodexProviderDialog from "../CodexProviderDialog";
import PromptDialog from "../PromptDialog";
import type { ProviderPreset, AgentConfig, CodexProviderConfig, PromptTemplate } from "../../types";

export interface AlertDialogState {
  isOpen: boolean;
  type: AlertType;
  title: string;
  message: string;
}

export interface DeleteConfirmState {
  isOpen: boolean;
  name: string;
  onConfirm: () => void;
}

export interface ProviderDialogState {
  isOpen: boolean;
  provider: ProviderPreset | null;
}

export interface AgentDialogState {
  isOpen: boolean;
  agent: AgentConfig | null;
}

export interface CodexProviderDialogState {
  isOpen: boolean;
  provider: CodexProviderConfig | null;
}

export interface PromptDialogState {
  isOpen: boolean;
  prompt: PromptTemplate | null;
}

interface SettingsDialogsProps {
  // Alert
  alertDialog: AlertDialogState;
  onCloseAlert: () => void;

  // Provider
  providerDialog: ProviderDialogState;
  providerDeleteConfirm: DeleteConfirmState;
  onCloseProviderDialog: () => void;
  onSaveProvider: (preset: ProviderPreset) => void;
  onCancelProviderDelete: () => void;

  // Agent
  agentDialog: AgentDialogState;
  agentDeleteConfirm: DeleteConfirmState;
  onCloseAgentDialog: () => void;
  onSaveAgent: (data: { name: string; prompt: string }) => void;
  onCancelAgentDelete: () => void;

  // Codex Provider
  codexProviderDialog: CodexProviderDialogState;
  codexDeleteConfirm: DeleteConfirmState;
  onCloseCodexProviderDialog: () => void;
  onSaveCodexProvider: (provider: CodexProviderConfig) => void;
  onCancelCodexDelete: () => void;

  // Prompt
  promptDialog: PromptDialogState;
  promptDeleteConfirm: DeleteConfirmState;
  onClosePromptDialog: () => void;
  onSavePrompt: (data: { name: string; content: string }) => void;
  onCancelPromptDelete: () => void;

  // Toast
  addToast?: (message: string, type: "success" | "error" | "info") => void;

  // 子节点（用于渲染额外弹窗，如导入导出）
  children?: ReactNode;
}

export default function SettingsDialogs({
  alertDialog,
  onCloseAlert,
  providerDialog,
  providerDeleteConfirm,
  onCloseProviderDialog,
  onSaveProvider,
  onCancelProviderDelete,
  agentDialog,
  agentDeleteConfirm,
  onCloseAgentDialog,
  onSaveAgent,
  onCancelAgentDelete,
  codexProviderDialog,
  codexDeleteConfirm,
  onCloseCodexProviderDialog,
  onSaveCodexProvider,
  onCancelCodexDelete,
  promptDialog,
  promptDeleteConfirm,
  onClosePromptDialog,
  onSavePrompt,
  onCancelPromptDelete,
  addToast,
  children,
}: SettingsDialogsProps) {
  return (
    <>
      {/* 警告对话框 */}
      <AlertDialog
        isOpen={alertDialog.isOpen}
        type={alertDialog.type}
        title={alertDialog.title}
        message={alertDialog.message}
        onClose={onCloseAlert}
      />

      {/* Provider 添加/编辑 */}
      <ProviderDialog
        isOpen={providerDialog.isOpen}
        preset={providerDialog.provider}
        onClose={onCloseProviderDialog}
        onSave={onSaveProvider}
      />

      {/* Provider 删除确认 */}
      <ConfirmDialog
        isOpen={providerDeleteConfirm.isOpen}
        title="删除确认"
        message={`确定要删除 Provider "${providerDeleteConfirm.name}" 吗？此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        onConfirm={providerDeleteConfirm.onConfirm}
        onCancel={onCancelProviderDelete}
      />

      {/* Agent 添加/编辑 */}
      <AgentDialog
        isOpen={agentDialog.isOpen}
        agent={agentDialog.agent}
        onClose={onCloseAgentDialog}
        onSave={onSaveAgent}
      />

      {/* Agent 删除确认 */}
      <ConfirmDialog
        isOpen={agentDeleteConfirm.isOpen}
        title="删除确认"
        message={`确定要删除 Agent "${agentDeleteConfirm.name}" 吗？此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        onConfirm={agentDeleteConfirm.onConfirm}
        onCancel={onCancelAgentDelete}
      />

      {/* Codex Provider 添加/编辑 */}
      <CodexProviderDialog
        isOpen={codexProviderDialog.isOpen}
        provider={codexProviderDialog.provider}
        onClose={onCloseCodexProviderDialog}
        onSave={onSaveCodexProvider}
        addToast={addToast || (() => {})}
      />

      {/* Codex Provider 删除确认 */}
      <ConfirmDialog
        isOpen={codexDeleteConfirm.isOpen}
        title="删除确认"
        message={`确定要删除 Codex Provider "${codexDeleteConfirm.name}" 吗？此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        onConfirm={codexDeleteConfirm.onConfirm}
        onCancel={onCancelCodexDelete}
      />

      {/* Prompt 添加/编辑 */}
      <PromptDialog
        isOpen={promptDialog.isOpen}
        prompt={promptDialog.prompt}
        onClose={onClosePromptDialog}
        onSave={onSavePrompt}
      />

      {/* Prompt 删除确认 */}
      <ConfirmDialog
        isOpen={promptDeleteConfirm.isOpen}
        title="删除确认"
        message={`确定要删除 Prompt 模板 "${promptDeleteConfirm.name}" 吗？此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        onConfirm={promptDeleteConfirm.onConfirm}
        onCancel={onCancelPromptDelete}
      />

      {/* 额外弹窗（导入导出等） */}
      {children}
    </>
  );
}
