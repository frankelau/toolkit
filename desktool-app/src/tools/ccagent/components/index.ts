// 组件 barrel exports — Phase 2/3/4/5/6/7

// Sprint O1: MessageItem 目录化（原顶层 4 文件合并到 MessageItem/）
export {
  MessageRow, DiffViewer, ToolUseView, ThinkingBlock, UsageBadge, MessageActions, CopyButton,
  groupBlocks,
} from "./MessageItem";
export type { GroupedBlock } from "./MessageItem";
export { ContentBlockRenderer } from "./MessageItem";
export type { ContentBlock, ContentBlockRendererProps } from "./MessageItem";
export { ErrorDiagnosticCard, matchErrorPattern, ErrorTextWithDiagnostic } from "./MessageItem";
export type { DiagnosticPattern, ErrorDiagnosticCardProps } from "./MessageItem";
export { ProviderNotConfiguredCard } from "./MessageItem";
export type { ProviderNotConfiguredCardProps } from "./MessageItem";

export { PermissionDialog } from "./PermissionDialog";
export { StatusPanel } from "./StatusPanel";
export type { StatusPanelProps } from "./StatusPanel";
export { ChatInputBox } from "./ChatInputBox";
export type { ChatInputBoxProps, ChatInputBoxHandle } from "./ChatInputBox";
export { SettingsPanel, McpConfigEditor } from "./SettingsPanel";
export type { SettingsPanelProps } from "./SettingsPanel";
export { HistoryPanel } from "./HistoryPanel";
export type { HistoryPanelProps } from "./HistoryPanel";
export { HistoryView } from "./history/HistoryView";
export type { HistoryViewProps } from "./history/HistoryView";

// Phase 8: 高级功能对话框
export {
  PlanApprovalDialog,
  AskUserQuestionDialog,
  RewindDialog,
  ContextUsageDialog,
  UsageStatisticsDialog,
} from "./dialogs";
export type {
  PlanApprovalRequest,
  AskUserQuestionRequest,
  Question,
  QuestionOption,
  RewindRequest,
  ContextUsageData,
  ContextCategory,
  SessionRecord,
} from "./dialogs";

// 需求补齐：Agent 管理 / Prompt 增强 / 文件选中上下文
export { AgentSection } from "./AgentSection";
export { PromptEnhancerDialog } from "./PromptEnhancerDialog";
export { ContextBar } from "./ContextBar";

// Sprint E: 缺失组件补齐
export { ChatHeader } from "./ChatHeader";
export type { ChatHeaderProps } from "./ChatHeader";
export { MessageList } from "./MessageList";
export type { MessageListProps } from "./MessageList";
export { CollapsibleTextBlock } from "./CollapsibleTextBlock";
export type { CollapsibleTextBlockProps } from "./CollapsibleTextBlock";
export { SubagentProcessDetails } from "./StatusPanel";
export type { SubagentProcessDetailsProps } from "./StatusPanel";
export { AppDialogs } from "./AppDialogs";
export type { AppDialogsProps } from "./AppDialogs";

// Sprint E: common 组件
export {
  VirtualList, ErrorBoundary, ToastContainer, ConfirmDialog,
  ScrollControl, FileIcon,
} from "./common";
export type {
  VirtualListProps, ErrorBoundaryProps,
  ToastItem, ToastType, ToastProps,
  ConfirmDialogProps, ScrollControlProps,
} from "./common";
// common/ContextMenu 保留为旧实现，新实现使用 ./ContextMenu

// Sprint E: history 组件
export { HistoryListItem, HistoryFilters, HistoryActions } from "./history";
export type { HistoryListItemProps, HistoryFiltersProps, HistoryActionsProps } from "./history";

// Sprint E: groupBlocks（工具分组）
export {
  BashToolGroupBlock, EditToolGroupBlock, ReadToolGroupBlock,
  SearchToolGroupBlock, AgentGroupBlock, groupConsecutiveTools, shouldGroup,
} from "./toolBlocks/groupBlocks";
export type { GroupedTool, ToolGroupBlockProps } from "./toolBlocks/groupBlocks";

// Sprint E: 追加对话框
export { DiscardAllDialog, UndoConfirmDialog, RewindSelectDialog } from "./dialogs";
export type { RewindableItem } from "./dialogs";
export { CustomModelDialog } from "./dialogs/CustomModelDialog";
export { ConversationSearch } from "./dialogs/ConversationSearch";
export { MessageAnchorRail } from "./MessageAnchorRail";
export { TokenIndicator } from "./TokenIndicator";

// Sprint F: 后端就绪后补齐的组件（ProviderNotConfiguredCard 已移入 MessageItem/）
// Sprint F + O4: SkillsSettingsSection 已移入 skills/ 目录
export { SkillsSettingsSection } from "./skills";
export type { SkillsSettingsSectionProps } from "./skills";
export { SkillConfirmDialog } from "./skills";
export type { SkillConfirmDialogProps } from "./skills";
export { SkillHelpDialog } from "./skills";
export type { SkillHelpDialogProps } from "./skills";
export { default as MarkdownBlock } from "./MarkdownBlock";
export type { MarkdownBlockProps } from "./MarkdownBlock";

// Sprint J: 缺失组件补齐
export { WelcomeScreen } from "./WelcomeScreen";
export type { WelcomeScreenProps } from "./WelcomeScreen";
export { APP_VERSION } from "./WelcomeScreen";
export { default as AgentDialog } from "./AgentDialog";
export { default as CodexProviderDialog } from "./CodexProviderDialog";
export { default as PromptDialog } from "./PromptDialog";
export { default as ChangelogDialog } from "./ChangelogDialog";
export { AlertDialog } from "./AlertDialog";
export type { AlertType } from "./AlertDialog";
export { WaitingIndicator } from "./WaitingIndicator";
export { UsageStatisticsSection } from "./UsageStatistics";
export type { UsageStatisticsSectionProps } from "./UsageStatistics";
export { default as EnvVarEditor } from "./EnvVarEditor";

// Sprint J: Icons 统一图标库
export {
  BackIcon, StopIcon, SendIcon, CloseIcon, SaveIcon, RefreshIcon,
  AddIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon,
  ErrorIcon, WarningIcon, SuccessIcon, InfoIcon,
} from "./Icons";

// Sprint J: shared 组件
export { ProviderModelIcon, resolveIconVendor } from "./shared";
export type { ProviderModelIconProps, ModelVendor } from "./shared";

// Sprint J: 动画装饰
export { AnimatedText } from "./AnimatedText";
export { BlinkingLogo } from "./BlinkingLogo";

// Sprint U3: 补齐缺失组件
export { ContextMenu } from "./ContextMenu";
export type { ContextMenuItem } from "./ContextMenu";

// FileTree
export { FileTreePanel } from "./FileTreePanel";
// FilePreview
export { FilePreviewPanel } from "./FilePreviewPanel";
// ContextPanel
export { ContextPanel } from "./ContextPanel";
// SessionTabBar
export { SessionTabBar } from "./SessionTabBar";
