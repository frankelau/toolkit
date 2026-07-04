// claudeModelMapping.ts — Claude 模型名映射

const MODEL_ALIASES: Record<string, string> = {
  "opus": "claude-opus-4-20250514",
  "sonnet": "claude-sonnet-4-20250514",
  "haiku": "claude-haiku-4-20250514",
  "claude-opus-4-8": "claude-opus-4-8-20250610",
};

const MODEL_LABELS: Record<string, string> = {
  "claude-opus-4-20250514": "Opus 4",
  "claude-sonnet-4-20250514": "Sonnet 4",
  "claude-haiku-4-20250514": "Haiku 4",
  "claude-opus-4-8-20250610": "Opus 4.8",
};

/** 把别名转成完整模型 ID */
export function resolveModelAlias(alias: string): string {
  return MODEL_ALIASES[alias] ?? alias;
}

/** 获取模型显示名 */
export function getModelLabel(model: string): string {
  return MODEL_LABELS[model] ?? model;
}

/** 判断是否是 1M 上下文模型 */
export function is1MContextModel(model: string): boolean {
  return model.includes("[1m]");
}

/** 获取上下文窗口大小 */
export function getContextWindow(model: string): number {
  return is1MContextModel(model) ? 1_000_000 : 200_000;
}
