// useTriggerDetection — 通用触发检测
// 对齐 cc-gui useTriggerDetection

import { useCallback } from "react";

export function useTriggerDetection() {
  /** 检测文本中指定位置是否匹配某个触发模式 */
  const detectTrigger = useCallback((
    text: string,
    cursorPos: number,
    triggerChar: string,
    options: { wordBoundary?: boolean; lineStart?: boolean } = {}
  ): { start: number; query: string } | null => {
    const before = text.slice(0, cursorPos);
    const escaped = triggerChar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    if (options.lineStart) {
      // 必须在行首
      const match = before.match(new RegExp(`(?:^|\\n)${escaped}([^${escaped}\\n]*)$`));
      if (match) {
        const start = cursorPos - match[0].length + (match[0].startsWith("\n") ? 1 : 0);
        return { start, query: match[1] };
      }
    } else if (options.wordBoundary) {
      // 必须在空格后或行首
      const match = before.match(new RegExp(`(?:^|\\s)${escaped}([^${escaped}\\s]*)$`));
      if (match) {
        const start = cursorPos - match[0].length + 1;
        return { start, query: match[1] };
      }
    } else {
      // 任意位置
      const match = before.match(new RegExp(`${escaped}([^${escaped}\\s]*)$`));
      if (match) {
        return { start: cursorPos - match[0].length, query: match[1] };
      }
    }
    return null;
  }, []);

  return { detectTrigger };
}
