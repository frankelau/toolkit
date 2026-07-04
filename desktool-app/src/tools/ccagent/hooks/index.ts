// hooks barrel exports — Sprint A + I

// Sprint Final F3: i18n 适配 hook
export { useLocale } from "./useLocale";

export { useDialogCountdownTimeout } from "./useDialogCountdownTimeout";
export { useScrollBehavior } from "./useScrollBehavior";
export { useMessageQueue } from "./useMessageQueue";
export { useConversationSearch } from "./useConversationSearch";
export { useFileChanges } from "./useFileChanges";
export { useSubagents } from "./useSubagents";
export { useModelProviderState } from "./useModelProviderState";
export { useRewindHandlers } from "./useRewindHandlers";
export { useStreamingMessages } from "./useStreamingMessages";
export { useSessionManagement } from "./useSessionManagement";

// Sprint I: 顶层 hooks 补齐（15 个）
export { useChatComputations } from "./useChatComputations";
export type { ChatComputations } from "./useChatComputations";

export { useContextActions } from "./useContextActions";
export type { ContextActions } from "./useContextActions";

export { useContextMenu } from "./useContextMenu";
export type { useContextMenuReturn, ContextMenuItem } from "./useContextMenu";

export { useDialogManagement } from "./useDialogManagement";
export type { DialogState, DialogActions } from "./useDialogManagement";

export { useDialogResize } from "./useDialogResize";
export type { DialogResizeState } from "./useDialogResize";

export { useFileChangesManagement } from "./useFileChangesManagement";
export type { FileChangesManagement } from "./useFileChangesManagement";

export { useHistoryLoader } from "./useHistoryLoader";
export type { HistoryLoader } from "./useHistoryLoader";

export { useIsToolDenied } from "./useIsToolDenied";
export type { ToolDeniedState } from "./useIsToolDenied";

export { useMessageProcessing } from "./useMessageProcessing";
export type { MessageProcessingResult } from "./useMessageProcessing";

export { useMessageSender } from "./useMessageSender";
export type { MessageSender, MessageSenderOptions } from "./useMessageSender";

export { useThemeInit } from "./useThemeInit";

export { useWindowCallbacks, useWindowVisibility } from "./useWindowCallbacks";
export type { WindowCallbacks } from "./useWindowCallbacks";

export { useFloatingTextTooltip } from "./useFloatingTextTooltip";
export type { TooltipState } from "./useFloatingTextTooltip";

export { useMarkdownFileLinkTooltip } from "./useMarkdownFileLinkTooltip";
export type { FileLinkTooltipState } from "./useMarkdownFileLinkTooltip";

export { useResolvedFileLinkTooltip } from "./useResolvedFileLinkTooltip";
export type { ResolvedFileLink } from "./useResolvedFileLinkTooltip";

// Sprint G: mega-hook
export { useCcAgentState } from "./useCcAgentState";
export type { CcAgentState } from "./useCcAgentState";

// ---- Sprint R: providers + windowCallbacks ----

// Provider hooks
export * from "./providers";

// Window callbacks（后端事件回调系统）
export * from "./windowCallbacks";
