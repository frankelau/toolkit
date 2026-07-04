// turnScope.ts — 轮次作用域（用于区分不同 assistant 轮次）

let currentTurnId: string | null = null;
let turnCounter = 0;

/** 开始新轮次 */
export function startNewTurn(): string {
  turnCounter++;
  currentTurnId = `turn-${turnCounter}-${Date.now()}`;
  return currentTurnId;
}

/** 获取当前轮次 id */
export function getCurrentTurnId(): string | null {
  return currentTurnId;
}

/** 重置轮次计数器（新会话时调用） */
export function resetTurnScope(): void {
  currentTurnId = null;
  turnCounter = 0;
}
