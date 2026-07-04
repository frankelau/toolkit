// constants/performance.ts — 性能阈值常量
// Sprint Final F5: 对齐 cc-gui constants/performance.ts
//
// 集中管理性能相关阈值，避免魔法数字散落各处。
// 数值参考 cc-gui 的实测调优结果。

/**
 * 文本长度阈值
 *
 * 不同操作的计算成本不同，因此使用不同阈值：
 * - 补全检测涉及光标定位 + 触发解析（开销大）
 * - 文件标签渲染涉及正则 + DOM 操作（中等）
 * - execCommand 文本插入需维护撤销历史（大文本极慢）
 */
export const TEXT_LENGTH_THRESHOLDS = {
  /** 补全检测（@ / / # 触发）最大文本长度 — 超过 10K 字符开销 >50ms */
  COMPLETION_DETECTION: 10000,
  /** 文件标签渲染最大文本长度 — 50K 字符，运行频率低故更宽容 */
  FILE_TAG_RENDERING: 50000,
  /** execCommand → Range API 切换阈值 — 5K 字符，execCommand 在大文本下 6s+ vs Range <100ms */
  LARGE_TEXT_INSERTION: 5000,
} as const;

/**
 * 渲染上限（防止 UI 卡顿）
 */
export const RENDERING_LIMITS = {
  /** 单次操作最大文件标签数 — 超过 50 个渲染 >100ms */
  MAX_FILE_TAGS_PER_RENDER: 50,
  /** 单次渲染最大消息数 — 虚拟滚动阈值 */
  MAX_MESSAGES_PER_RENDER: 200,
  /** 工具调用结果最大展示行数 */
  MAX_TOOL_RESULT_LINES: 500,
} as const;

/**
 * 性能计时配置（调试用）
 */
export const PERF_TIMING = {
  /** 性能调试模式下的最小日志阈值（ms）— 低于此值不记录 */
  MIN_LOG_THRESHOLD_MS: 5,
  /** 慢操作高亮阈值（ms）— 超过此值标红 */
  SLOW_OPERATION_THRESHOLD_MS: 50,
} as const;

/**
 * 防抖计时配置
 */
export const DEBOUNCE_TIMING = {
  /** 补全触发检测防抖（ms）— 80ms，兼顾响应与 CPU */
  COMPLETION_DETECTION_MS: 80,
  /** 文件标签渲染防抖（ms）— 300ms，降低 DOM 操作频率 */
  FILE_TAG_RENDERING_MS: 300,
  /** onInput 回调防抖（ms）— 100ms，减少父组件重渲染 */
  ON_INPUT_CALLBACK_MS: 100,
  /** 搜索输入防抖（ms）— 150ms */
  SEARCH_INPUT_MS: 150,
} as const;

/**
 * 流式渲染配置
 */
export const STREAMING_THRESHOLDS = {
  /** 流式 token 批处理大小 — 攒够 N 个 token 再渲染，减少 React 重渲染 */
  TOKEN_BATCH_SIZE: 8,
  /** 流式渲染节流间隔（ms）— 最多每 16ms 渲染一次（60fps） */
  RENDER_THROTTLE_MS: 16,
  /** 思考内容折叠阈值（字符）— 超过则默认折叠 */
  THINKING_COLLAPSE_THRESHOLD: 500,
} as const;

/** 类型定义（供外部消费） */
export type TextLengthThresholds = typeof TEXT_LENGTH_THRESHOLDS;
export type RenderingLimits = typeof RENDERING_LIMITS;
export type PerfTiming = typeof PERF_TIMING;
export type DebounceTiming = typeof DEBOUNCE_TIMING;
export type StreamingThresholds = typeof STREAMING_THRESHOLDS;
