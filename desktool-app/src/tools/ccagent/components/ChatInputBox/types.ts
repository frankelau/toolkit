// ChatInputBox/types.ts — 输入框相关类型和常量（Sprint R 补齐，对齐 cc-gui）

/** 权限模式 */
export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan";

/** 推理强度（Codex/OpenAI 概念） */
export type ReasoningEffort = "low" | "medium" | "high" | "xhigh" | "max";

/** Codex 快速模式 */
export type CodexFastMode = "normal" | "fast";

/** Claude 模型列表 */
export const CLAUDE_MODELS: { id: string; label: string }[] = [
  { id: "sonnet", label: "Sonnet" },
  { id: "opus", label: "Opus" },
  { id: "haiku", label: "Haiku" },
  { id: "claude-opus-4-8", label: "Opus 4.8" },
  { id: "claude-sonnet-4-5", label: "Sonnet 4.5" },
];

/** Codex 模型列表 */
export const CODEX_MODELS: { id: string; label: string }[] = [
  { id: "o3", label: "o3" },
  { id: "o4-mini", label: "o4-mini" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-5", label: "GPT-5" },
];

/** 选中的 Agent */
export interface SelectedAgent {
  id: string;
  name: string;
  prompt?: string;
}

/** 权限模式校验 */
export function isValidPermissionMode(value: unknown): value is PermissionMode {
  return (
    typeof value === "string" &&
    ["default", "acceptEdits", "bypassPermissions", "plan"].includes(value)
  );
}

/** 推理强度校验 */
export function isValidReasoningEffort(value: unknown): value is ReasoningEffort {
  return (
    typeof value === "string" &&
    ["low", "medium", "high", "xhigh", "max"].includes(value)
  );
}

/** Codex 快速模式校验 */
export function isValidCodexFastMode(value: unknown): value is CodexFastMode {
  return typeof value === "string" && ["normal", "fast"].includes(value);
}

/** 1M 上下文后缀 */
const ONE_M_SUFFIX = "[1m]";

/** 判断模型 ID 是否带 1M 上下文后缀 */
export function has1MContextSuffix(modelId: string): boolean {
  return modelId.endsWith(ONE_M_SUFFIX);
}

/** 去除 1M 上下文后缀 */
export function strip1MContextSuffix(modelId: string): string {
  if (has1MContextSuffix(modelId)) {
    return modelId.slice(0, -ONE_M_SUFFIX.length);
  }
  return modelId;
}

/** 添加 1M 上下文后缀 */
export function apply1MContextSuffix(modelId: string, enabled: boolean): string {
  const stripped = strip1MContextSuffix(modelId);
  return enabled ? `${stripped}${ONE_M_SUFFIX}` : stripped;
}

/** 标准化 Claude 模型 ID（小写、去后缀） */
export function normalizeClaudeModelId(modelId: string): string {
  return strip1MContextSuffix(modelId).toLowerCase();
}
