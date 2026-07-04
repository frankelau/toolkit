// CC Agent 模块入口
// Phase 1: 基础架构拆分 — 导出类型、常量、工具函数
// Sprint A: contexts + hooks

// 显式 re-export 类型（兼容性更好）
export type {
  Engine, EngineInfo, Attachment, ClaudeSession, FileEntry, SkillDef,
  ChatMessage, ToolUseBlock, DiffResult, DiffHunk, MessageUsage,
  PermissionRequest, TodoItem, SubagentInfo, SubagentStatus,
  EditOperation, FileChangeSummary, StatusPanelTab, ProviderPreset,
  FavoriteItem, AgentConfig, SelectedContext,
} from "./types";

export {
  PROVIDER_PRESETS, MODELS, EFFORT_LEVELS, PERMISSION_MODES,
  DEFAULT_SLASH_COMMANDS, TOOL_LABELS, SAFE_TOOLS, uid,
} from "./constants";

export {
  renderMd, formatCost, formatTokens, highlightText, toolLabel,
  summarizeToolInput, redactSecrets, computeDiff, countLines,
  buildEditOperation, buildDiffForTool,
} from "./utils";

// Sprint A: Contexts + Hooks
export * from "./contexts";
export * from "./hooks";
