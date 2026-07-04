// generateId.ts — 唯一 ID 生成器
// 对齐 cc-gui ChatInputBox/utils/generateId.ts

/**
 * 生成唯一 ID（JCEF 兼容）。
 * 优先使用 crypto.randomUUID，不可用时回退到 时间戳 + 随机串。
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
