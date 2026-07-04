// AppDialogs — 统一弹窗编排，把所有对话框集中渲染
// 对齐 cc-gui AppDialogs.tsx

import type { ReactNode } from "react";
import { PermissionDialog } from "./PermissionDialog";
import {
  PlanApprovalDialog, AskUserQuestionDialog, RewindDialog,
  ContextUsageDialog, UsageStatisticsDialog,
  DiscardAllDialog, UndoConfirmDialog, RewindSelectDialog,
} from "./dialogs";
import type {
  PlanApprovalRequest, AskUserQuestionRequest, RewindRequest,
  SessionRecord,
} from "./dialogs";
import type { RewindableItem } from "./dialogs";
import { PromptEnhancerDialog } from "./PromptEnhancerDialog";
import type { PermissionRequest, ChatMessage } from "../types";

export interface AppDialogsProps {
  // PermissionDialog
  permRequest: PermissionRequest | null;
  sessionAlwaysAllow: Set<string>;
  onAllow: () => void;
  onDeny: () => void;
  // PlanApproval
  planApproval: PlanApprovalRequest | null;
  onPlanApprove: (mode: string) => void;
  onPlanReject: () => void;
  // AskUser
  askUserQuestion: AskUserQuestionRequest | null;
  onAskUserSubmit: (requestId: string, answers: Record<string, string | string[]>) => void;
  onAskUserCancel: () => void;
  // Rewind
  rewindReq: RewindRequest | null;
  rewindLoading: boolean;
  onRewindConfirm: () => void;
  onRewindCancel: () => void;
  // RewindSelect
  rewindSelectOpen: boolean;
  rewindableMessages: RewindableItem[];
  onRewindSelect: (item: RewindableItem) => void;
  onRewindSelectCancel: () => void;
  // ContextUsage
  ctxUsageOpen: boolean;
  ctxUsageData: import("./dialogs").ContextUsageData | null;
  onCtxUsageClose: () => void;
  // UsageStatistics
  usageStatsOpen: boolean;
  totalCost: number;
  totalInput: number;
  totalOutput: number;
  totalSessions: number;
  messages: ChatMessage[];
  sessionRecords: SessionRecord[];
  onUsageStatsClose: () => void;
  onUsageReset: () => void;
  // DiscardAll
  discardAllOpen: boolean;
  discardFileCount: number;
  discardAdditions: number;
  discardDeletions: number;
  onDiscardAllConfirm: () => void;
  onDiscardAllCancel: () => void;
  // UndoFile
  undoFileOpen: boolean;
  undoFilePath: string;
  undoAdditions: number;
  undoDeletions: number;
  onUndoFileConfirm: () => void;
  onUndoFileCancel: () => void;
  // PromptEnhancer
  peOpen: boolean;
  peLoading: boolean;
  peOriginal: string;
  peEnhanced: string;
  onPeUseEnhanced: () => void;
  onPeKeepOriginal: () => void;
  onPeClose: () => void;
}

export function AppDialogs(props: AppDialogsProps): ReactNode {
  const {
    permRequest, sessionAlwaysAllow, onAllow, onDeny,
    planApproval, onPlanApprove, onPlanReject,
    askUserQuestion, onAskUserSubmit, onAskUserCancel,
    rewindReq, rewindLoading, onRewindConfirm, onRewindCancel,
    rewindSelectOpen, rewindableMessages, onRewindSelect, onRewindSelectCancel,
    ctxUsageOpen, ctxUsageData, onCtxUsageClose,
    usageStatsOpen, totalCost, totalInput, totalOutput, totalSessions, messages, sessionRecords, onUsageStatsClose, onUsageReset,
    discardAllOpen, discardFileCount, discardAdditions, discardDeletions, onDiscardAllConfirm, onDiscardAllCancel,
    undoFileOpen, undoFilePath, undoAdditions, undoDeletions, onUndoFileConfirm, onUndoFileCancel,
    peOpen, peLoading, peOriginal, peEnhanced, onPeUseEnhanced, onPeKeepOriginal, onPeClose,
  } = props;

  return (
    <>
      {permRequest && (
        <PermissionDialog
          request={permRequest}
          onAllow={onAllow}
          onDeny={onDeny}
          sessionAlwaysAllow={sessionAlwaysAllow}
        />
      )}

      {planApproval && (
        <PlanApprovalDialog
          request={planApproval}
          onApprove={onPlanApprove}
          onReject={onPlanReject}
        />
      )}

      {askUserQuestion && (
        <AskUserQuestionDialog
          request={askUserQuestion}
          onSubmit={onAskUserSubmit}
          onCancel={onAskUserCancel}
        />
      )}

      {rewindReq && (
        <RewindDialog
          request={rewindReq}
          loading={rewindLoading}
          onConfirm={onRewindConfirm}
          onCancel={onRewindCancel}
        />
      )}

      <RewindSelectDialog
        isOpen={rewindSelectOpen}
        messages={rewindableMessages}
        onSelect={onRewindSelect}
        onCancel={onRewindSelectCancel}
      />

      <ContextUsageDialog
        isOpen={ctxUsageOpen}
        data={ctxUsageData}
        onClose={onCtxUsageClose}
      />

      <UsageStatisticsDialog
        isOpen={usageStatsOpen}
        onClose={onUsageStatsClose}
        totalCost={totalCost}
        totalInput={totalInput}
        totalOutput={totalOutput}
        totalSessions={totalSessions}
        messages={messages}
        sessions={sessionRecords}
        onReset={onUsageReset}
      />

      <DiscardAllDialog
        isOpen={discardAllOpen}
        fileCount={discardFileCount}
        totalAdditions={discardAdditions}
        totalDeletions={discardDeletions}
        onConfirm={onDiscardAllConfirm}
        onCancel={onDiscardAllCancel}
      />

      <UndoConfirmDialog
        isOpen={undoFileOpen}
        filePath={undoFilePath}
        additions={undoAdditions}
        deletions={undoDeletions}
        onConfirm={onUndoFileConfirm}
        onCancel={onUndoFileCancel}
      />

      <PromptEnhancerDialog
        isOpen={peOpen}
        isLoading={peLoading}
        originalPrompt={peOriginal}
        enhancedPrompt={peEnhanced}
        onUseEnhanced={onPeUseEnhanced}
        onKeepOriginal={onPeKeepOriginal}
        onClose={onPeClose}
      />
    </>
  );
}
