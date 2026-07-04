// index.ts — utils barrel exports

// Markdown
export { renderMd, renderMarkdownFull, renderStreamingContent, hasPossibleMermaidContent, isMermaidKeyword, configureMarked, makeStreamSafe, stripSystemTags, stripAndEscapeOutsideCodeBlocks } from "./markdown";

// 格式化
export { formatCost, formatTokens, formatDuration, formatRelativeTime, formatProjectPath } from "./format";

// 搜索高亮
export { highlightText } from "./highlight";

// 工具相关
export {
  toolLabel, summarizeToolInput,
  getInputString, getInputNumber, getInputArray,
  truncate, getFileName,
} from "./toolUtils";

// 密钥脱敏
export { redactSecrets } from "./redact";

// Diff
export { computeDiff, countLines, buildEditOperation, buildDiffForTool } from "./diff";

// 复制
export { copyToClipboard } from "./copyUtils";

// 导出
export { exportMessagesToMarkdown } from "./exportMarkdown";

// 错误匹配
export { matchErrorPattern } from "./errorMatcher";
export type { DiagnosticPattern } from "./errorMatcher";

// 通用助手
export { uid, debounce, throttle, deepEqual, safeJsonParse, cx } from "./helpers";

// LRU 缓存
export { LRUCache } from "./lruCache";

// 消息工具
export {
  extractToolUses, countUserMessages, countAssistantMessages,
  countToolUses, countToolErrors,
  getLastUserMessage, getLastAssistantMessage,
  sumUsage, searchMessages, summarizeMessage, getMessageKey,
  countToolsByType, computeTurnStats, mergeStreamingMessage, computeSessionSummary,
} from "./messageUtils";
export type { ToolTypeStats, TurnStats, SessionSummary } from "./messageUtils";

// Claude 模型映射
export { resolveModelAlias, getModelLabel, is1MContextModel, getContextWindow } from "./claudeModelMapping";

// 流式标记
export { STREAM_EVENT_TYPES, CONTENT_BLOCK_TYPES, TOOL_RESULT_STATUS } from "./streamMarkers";

// 视口
export { isElementInViewport, scrollToElement, scrollToBottom, isScrolledToBottom, isScrolledToTop } from "./viewport";

// 文件图标
export { getFileIcon, getFileColor } from "./fileIcons";

// 权限弹窗超时
export { getPermissionDialogTimeout, setPermissionDialogTimeout, resetPermissionDialogTimeout } from "./permissionDialogTimeout";

// 内容块标准化
export {
  normalizeContentBlocks, extractText, extractThinking,
} from "./contentBlockNormalize";
export type { NormalizedContentBlock } from "./contentBlockNormalize";

// 工具常量
export {
  SAFE_TOOLS, TOOL_LABELS, FILE_TOOLS, SEARCH_TOOLS, TASK_TOOLS, AGENT_TOOLS, BASH_TOOLS,
  READ_TOOL_NAMES, EDIT_TOOL_NAMES, BASH_TOOL_NAMES, SEARCH_TOOL_NAMES, AGENT_TOOL_NAMES,
  TASK_MANAGE_TOOL_NAMES, TRANSIENT_INTERNAL_TOOL_NAMES, FILE_MODIFY_TOOL_NAMES,
  normalizeToolName, isToolName, isTransientInternalToolName,
} from "./toolConstants";

// 轮次作用域
export { startNewTurn, getCurrentTurnId, resetTurnScope } from "./turnScope";

// ---- Sprint Q 新增 utils ----

// 桥接层（Tauri 适配）
// backendCommands — 后端 Tauri command 包装器 (全 86 命令)
export {
  deleteSessionById, searchSessions, getSessionStats, getSessionStatus,
  refreshSessionIndex, sessionHealth,
  getSettings, saveSettings, getAppearance, saveAppearance,
  getNotificationSettings, saveNotificationSettings,
  getProviderSettings, saveProviderSettings,
  getProjectConfig, saveProjectConfig,
  getPermissionSettings, savePermissionSettings,
  getPermissionMode, setPermissionMode,
  getUsageStats, pushUsageRecord, resetUsageStats,
  listAllSkills, getSkillMetadata, toggleSkill, enableSkill, disableSkill, importSkill,
  addMcpServer, removeMcpServer, listProviderPresets,
  listPendingPermissions, removePermissionSession, clearPermissionMemory, respondPermission,
  getInputHistory, addInputHistory, clearInputHistory,
  startTerminal, listTerminals, killTerminal, executeTerminalCommand,
  listTabs, switchTab, startSessionWatcher, stopSessionWatcher,
  convertFromCodexFormat, convertToCodexFormat,
  savePromptTemplate, deletePromptTemplate,
  checkDependencies, clearCaches, cacheStats, getChangelog,
} from "./backendCommands";

// 能力订阅（Tauri event 适配）
export {
  fetchNodeProcesses, killNodeProcess, killAllOrphanProcesses, restartNodeDaemon,
  subscribeNodeProcesses, subscribeNodeProcessKillResult,
} from "./nodeProcessCapabilities";
export type {
  NodeProcessKind, NodeProcessInfo, NodeProcessTotals,
  NodeProcessSnapshot, NodeProcessKillResult,
} from "./nodeProcessCapabilities";

export {
  installRuntimeProviderDispatchers,
  subscribeProviderList, subscribeActiveProvider,
  subscribeCodexProviderList, subscribeActiveCodexProvider,
} from "./runtimeProviderCapabilities";

export {
  fetchCodexSubscriptionQuota, subscribeCodexSubscriptionQuota,
} from "./codexSubscriptionQuotaCapabilities";
export type {
  CodexSubscriptionQuotaWindow, CodexSubscriptionQuotaSnapshot,
} from "./codexSubscriptionQuotaCapabilities";

// Linkify
export {
  normalizeFileNavigationTarget, isMarkdownFileNavigationHref,
  parseFileLinkTarget, isJavaFqcnCandidate,
  decorateExistingAnchors, linkifyHtml, linkifyPlainTextSegment,
} from "./linkify";
export type { LinkifyType, FileLinkTarget, LinkifyMatch } from "./linkify";
export {
  getLinkifyCapabilities, setLinkifyCapabilities, applyLinkifyCapabilitiesPayload,
  subscribeLinkifyCapabilities, resetLinkifyCapabilities,
} from "./linkifyCapabilities";
export type { LinkifyCapabilities } from "./linkifyCapabilities";

// 工具命令路径解析
export {
  unwrapShellCommand, extractFilePathFromCommand, isFileViewingCommand,
  isCommandToolName, parseCommandType, COMMAND_TOOL_NAMES,
} from "./toolCommandPath";
export type { ParsedCommandType, ParsedCommandInfo } from "./toolCommandPath";

// 工具输入标准化
export { normalizeToolInput } from "./toolInputNormalization";

// 工具展示信息
export {
  extractPathsFromPatch, resolveToolTarget, getToolLineInfo,
  getToolEditCount, summarizeToolCommand,
} from "./toolPresentation";
export type { ToolTargetInfo } from "./toolPresentation";

// Todo 工具标准化
export {
  extractTodosFromToolUse, isTaskManageTool, extractAccumulatedTasks,
} from "./todoToolNormalization";
export { normalizeTodoStatus } from "./todoShared";
export type { RawTodoItem } from "./todoShared";

// 模型图标映射
export {
  resolveModelVendor, resolveProviderVendor, resolveIconVendor,
} from "./modelIconMapping";
export type { ModelVendor } from "./modelIconMapping";

// Diff 主题
export { getStoredDiffTheme, applyDiffTheme, clearDiffTheme } from "./diffTheme";
export type { DiffThemeMode } from "./diffTheme";

// 调试
export { debugLog, debugWarn, debugError, perfTimer } from "./debug";

// 展开/折叠状态缓存
export { getPersistedExpanded, setPersistedExpanded, clearAllPersistedExpanded } from "./expandedState";

// 可编辑目标检测
export { isEditableEventTarget } from "./isEditableEventTarget";

// Webview 重绘
export { forceWebviewRepaint } from "./forceWebviewRepaint";

// 消息合并缓存限制
export { MESSAGE_MERGE_CACHE_LIMIT } from "./messageMergeCache";

// 跳过新会话确认
export {
  getSkipNewSessionConfirm, setSkipNewSessionConfirm,
  isNewSessionConfirmEnabled, setNewSessionConfirmEnabled,
  SKIP_NEW_SESSION_CONFIRM_KEY, SKIP_NEW_SESSION_CONFIRM_EVENT,
} from "./skipNewSessionConfirm";
export type { SkipNewSessionConfirmChangedDetail } from "./skipNewSessionConfirm";

// 本地化工具
export { createLocalizeMessage } from "./localizationUtils";

// 文件图标映射数据
export { FILE_NAME_MAP } from "./fileIconMaps";
