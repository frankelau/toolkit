// constants/app.ts — 应用级常量
// Sprint Final F5: 应用级常量集中定义
//
// 与现有根目录 constants.ts（provider/model 等业务常量）互补，
// 本文件聚焦应用级元信息、存储键、会话/上下文限制等。

/**
 * 应用元信息
 */
export const APP_META = {
  /** 应用名称 */
  NAME: "CC Agent",
  /** 应用标识（用于 localStorage 前缀） */
  ID: "ccagent",
  /** 配置目录名（相对 HOME） */
  CONFIG_DIR: ".claude",
  /** Bridge 脚本目录 */
  BRIDGE_DIR: ".cc-bridge",
  /** 默认工作目录 */
  DEFAULT_CWD: "~",
} as const;

/**
 * localStorage 存储键
 *
 * 统一前缀避免冲突，集中管理便于清理。
 */
export const STORAGE_KEYS = {
  /** 语言设置 */
  LOCALE: "ccagent:locale",
  /** 最近工作目录列表 */
  RECENT_CWDS: "ccagent:recent_cwds",
  /** 最近使用的引擎 */
  LAST_ENGINE: "ccagent:last_engine",
  /** 最近使用的模型 */
  LAST_MODEL: "ccagent:last_model",
  /** 输入历史 */
  INPUT_HISTORY: "ccagent:input_history",
  /** 收藏的提示词 */
  FAVORITES: "ccagent:favorites",
  /** 使用统计 */
  USAGE_STATS: "ccagent:usage_stats",
  /** 设置面板展开状态 */
  SETTINGS_EXPANDED: "ccagent:settings_expanded",
  /** 窗口尺寸 */
  WINDOW_SIZE: "ccagent:window_size",
} as const;

/**
 * 会话限制
 */
export const SESSION_LIMITS = {
  /** 最大并发会话数 */
  MAX_CONCURRENT_SESSIONS: 8,
  /** 最大会话历史记录数 */
  MAX_SESSION_HISTORY: 100,
  /** 会话空闲超时（秒）— 超过自动清理 */
  IDLE_TIMEOUT_SECS: 3600,
  /** 单条消息最大长度 */
  MAX_MESSAGE_LENGTH: 100_000,
  /** 输入历史最大记录数 */
  MAX_INPUT_HISTORY: 50,
  /** 收藏最大数量 */
  MAX_FAVORITES: 100,
} as const;

/**
 * 上下文窗口（token）
 */
export const CONTEXT_WINDOW = {
  /** 默认上下文窗口 */
  DEFAULT: 200_000,
  /** 长上下文模型窗口（如 [1m] 后缀） */
  EXTENDED: 1_000_000,
  /** 上下文用量警告阈值（百分比） */
  WARN_THRESHOLD_PCT: 80,
  /** 上下文用量危险阈值（百分比）— 建议压缩 */
  DANGER_THRESHOLD_PCT: 95,
  /** 自动压缩触发阈值（百分比） */
  AUTO_COMPACT_PCT: 92,
} as const;

/**
 * 文件操作限制
 */
export const FILE_LIMITS = {
  /** 文件树最大深度 */
  MAX_TREE_DEPTH: 10,
  /** 文件列表最大条数 */
  MAX_LIST_FILES: 1000,
  /** 单文件读取最大行数 */
  MAX_READ_LINES: 5000,
  /** 文件大小上限（字节）— 超过警告 */
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  /** 忽略的默认 glob 模式 */
  DEFAULT_IGNORE_PATTERNS: [
    "node_modules", ".git", "dist", "build", "out",
    ".next", ".nuxt", ".cache", ".turbo", "coverage",
    "*.log", ".DS_Store", "Thumbs.db",
  ],
} as const;

/**
 * UI 限制
 */
export const UI_LIMITS = {
  /** Toast 自动消失时间（ms） */
  TOAST_DURATION_MS: 3000,
  /** 对话框默认宽度 */
  DIALOG_DEFAULT_WIDTH: 600,
  /** 对话框最大宽度 */
  DIALOG_MAX_WIDTH: 900,
  /** 代码块最大高度（px）— 超过滚动 */
  CODE_BLOCK_MAX_HEIGHT: 400,
  /** 消息列表底部留白（px） */
  MESSAGE_LIST_BOTTOM_PADDING: 80,
} as const;

/**
 * 超时配置（ms）
 */
export const TIMEOUTS = {
  /** Bridge 初始化超时 */
  BRIDGE_INIT_MS: 60_000,
  /** 会话启动超时 */
  SESSION_START_MS: 30_000,
  /** 引擎检测超时 */
  ENGINE_CHECK_MS: 10_000,
  /** 文件操作超时 */
  FILE_OP_MS: 15_000,
  /** 网络请求超时 */
  NETWORK_MS: 30_000,
} as const;

/** 类型定义 */
export type AppMeta = typeof APP_META;
export type StorageKeys = typeof STORAGE_KEYS;
export type SessionLimits = typeof SESSION_LIMITS;
export type ContextWindow = typeof CONTEXT_WINDOW;
export type FileLimits = typeof FILE_LIMITS;
export type UiLimits = typeof UI_LIMITS;
export type Timeouts = typeof TIMEOUTS;
