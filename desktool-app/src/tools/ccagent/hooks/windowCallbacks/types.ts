/**
 * WindowCallbacksOptions — ccagent 版本的回调选项类型
 *
 * 对齐 cc-gui 的 UseWindowCallbacksOptions，但适配 ccagent 的类型系统：
 * - ClaudeMessage → ChatMessage
 * - ProviderConfig → Record<string, unknown>
 * - 移除 cc-gui 特定的 window 全局槽位类型
 */

import type { MutableRefObject } from "react";
import type { ChatMessage } from "../../types";
import type { PermissionMode, SelectedAgent } from "../../components/ChatInputBox/types";

export interface ContextInfo {
  file: string;
  startLine?: number;
  endLine?: number;
  raw: string;
}

export interface WindowCallbacksOptions {
  // Toast
  addToast: (message: string, type?: "info" | "success" | "warning" | "error") => void;
  clearToasts: () => void;

  // Messages
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setStatus: React.Dispatch<React.SetStateAction<string>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setLoadingStartTime: React.Dispatch<React.SetStateAction<number | null>>;
  setIsThinking: React.Dispatch<React.SetStateAction<boolean>>;
  setStreamingActive: React.Dispatch<React.SetStateAction<boolean>>;
  setSummary: React.Dispatch<React.SetStateAction<unknown>>;
  setHistoryData: React.Dispatch<React.SetStateAction<unknown>>;

  // Session
  setCurrentSessionId: (id: string) => void;
  currentSessionIdRef: MutableRefObject<string | null>;
  customSessionTitleRef: MutableRefObject<string | null>;
  setCustomSessionTitle: (title: string) => void;
  updateHistoryTitle: (sessionId: string, title: string) => void;
  applyHistoryTitleLocal: (sessionId: string, title: string) => void;

  // SDK
  setSdkStatus: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  setSdkStatusLoaded: React.Dispatch<React.SetStateAction<boolean>>;

  // Usage
  setUsagePercentage: React.Dispatch<React.SetStateAction<number>>;
  setUsageUsedTokens: React.Dispatch<React.SetStateAction<number | undefined>>;
  setUsageMaxTokens: React.Dispatch<React.SetStateAction<number | undefined>>;

  // Permission mode
  setPermissionMode: React.Dispatch<React.SetStateAction<PermissionMode>>;
  setClaudePermissionMode: React.Dispatch<React.SetStateAction<PermissionMode>>;
  setCodexPermissionMode: React.Dispatch<React.SetStateAction<PermissionMode>>;

  // Models
  setSelectedClaudeModel: React.Dispatch<React.SetStateAction<string>>;
  setSelectedCodexModel: React.Dispatch<React.SetStateAction<string>>;

  // Provider
  currentProviderRef: MutableRefObject<string>;
  setActiveProviderConfig: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>;
  setProviderConfigVersion: React.Dispatch<React.SetStateAction<number>>;
  syncActiveProviderModelMapping: (provider?: Record<string, unknown> | null) => void;

  // Settings
  setClaudeSettingsAlwaysThinkingEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setStreamingEnabledSetting: React.Dispatch<React.SetStateAction<boolean>>;
  setSendShortcut: React.Dispatch<React.SetStateAction<"enter" | "cmdEnter">>;
  setAutoOpenFileEnabled: React.Dispatch<React.SetStateAction<boolean>>;

  // Dialogs
  openPermissionDialog: (request: unknown) => void;
  openAskUserQuestionDialog: (request: unknown) => void;
  openPlanApprovalDialog: (request: unknown) => void;

  // Rewind
  setIsRewinding: React.Dispatch<React.SetStateAction<boolean>>;
  setRewindDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentRewindRequest: React.Dispatch<React.SetStateAction<unknown>>;

  // Agent / selection
  setContextInfo: (info: ContextInfo | null) => void;
  setSelectedAgent: (agent: SelectedAgent | null) => void;

  // Streaming refs
  isStreamingRef: MutableRefObject<boolean>;
  useBackendStreamingRenderRef: MutableRefObject<boolean>;
  streamingMessageIndexRef: MutableRefObject<number>;
  streamingContentRef: MutableRefObject<string>;
  streamingThinkingRef: MutableRefObject<string>;
  autoExpandedThinkingKeysRef: MutableRefObject<Set<string>>;
  contentUpdateTimeoutRef: MutableRefObject<number | null>;
  thinkingUpdateTimeoutRef: MutableRefObject<number | null>;
  streamingTurnIdRef: MutableRefObject<number>;
}
