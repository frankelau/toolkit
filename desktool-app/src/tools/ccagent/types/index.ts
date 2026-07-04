// index.ts — types barrel exports

// 核心
export type { Engine, EngineInfo, Attachment, ChatMessage, ToolUseBlock, MessageUsage, DiffResult, DiffHunk, WorkspaceTab } from "./core";

// 会话
export type { ClaudeSession, FileEntry, SkillDef, FavoriteItem, SessionRecord } from "./session";

// 子 Agent
export type { SubagentInfo, SubagentStatus, TodoItem, StatusPanelTab } from "./subagent";

// 文件变更
export type { EditOperation, FileChangeSummary } from "./fileChanges";

// 权限
export type { PermissionRequest } from "./permission";

// Provider
export type { ProviderPreset, EnvVarEntry, EnvVarValidationIssue, CodexProviderConfig, ChangelogEntry } from "./provider";
export {
  CODEX_PROTECTED_ENV_KEYS, ENV_VAR_VALUE_MAX_LENGTH,
  isValidEnvVarKey, isProtectedEnvVarKey, validateEnvVarEntries,
} from "./provider";

// Agent
export type { AgentConfig, SelectedContext } from "./agent";

// 对话框
export type {
  PlanApprovalRequest, QuestionOption, Question, AskUserQuestionRequest,
  RewindRequest, RewindableMessage,
  ContextCategory, ContextUsageData,
} from "./dialogs";

// 依赖
export type { DependencyInfo } from "./dependency";

// Prompt
export type { PromptTemplate } from "./prompt";

// 使用统计
export type { UsageStats, SessionUsageRecord, ModelUsageStats, TimelineUsageStats } from "./usage";

// ---- Sprint Q 新增 types ----

// AI 功能配置
export type {
  AiFeatureProvider, AiFeatureResolutionSource, AiFeatureConfig,
  CommitAiProvider, CommitAiResolutionSource, CommitAiConfig,
} from "./aiFeatureConfig";
export { DEFAULT_AI_FEATURE_MODELS, DEFAULT_COMMIT_AI_CONFIG } from "./aiFeatureConfig";

// 批量导入
export type {
  ConflictStrategy, ImportPreviewItem, ImportPreviewResult, ImportResult,
} from "./import";

// MCP
export type {
  McpServerSpec, McpApps, McpServer, McpServersMap,
  CCSwitchConfig, ClaudeConfig, McpPreset,
  McpServerStatus, McpServerStatusInfo, McpLogEntry, McpServerValidationResult,
  CodexMcpServerSpec, CodexMcpServer, CodexConfig,
} from "./mcp";

// Prompt 增强器
export type {
  PromptEnhancerProvider, PromptEnhancerResolutionSource, PromptEnhancerConfig,
} from "./promptEnhancer";
export { DEFAULT_PROMPT_ENHANCER_CONFIG } from "./promptEnhancer";

// UI 字体配置
export type { ResolvedFontConfig, UiFontConfig, CodeFontConfig } from "./uiFontConfig";
