// useCompletionTriggerDetection — 补全触发检测
// 对齐 cc-gui useCompletionTriggerDetection

import { useCallback } from "react";

export type TriggerType = "file" | "slash" | "dollar" | "agent" | null;

export interface TriggerInfo {
  type: TriggerType;
  start: number;
  query: string;
}

export function useCompletionTriggerDetection() {
  const detect = useCallback((value: string, cursorPos: number): TriggerInfo | null => {
    // 检测 @ 触发文件补全
    const beforeCursor = value.slice(0, cursorPos);
    const atMatch = beforeCursor.match(/@([^@\s]*)$/);
    if (atMatch) {
      return { type: "file", start: cursorPos - atMatch[0].length, query: atMatch[1] };
    }

    // 检测 / 触发斜杠命令（必须在行首或空格后）
    const slashMatch = beforeCursor.match(/(?:^|\s)(\/[\w-]*)$/);
    if (slashMatch) {
      return { type: "slash", start: cursorPos - slashMatch[1].length, query: slashMatch[1] };
    }

    // 检测 $ 触发环境变量
    const dollarMatch = beforeCursor.match(/\$([A-Z_]*)$/);
    if (dollarMatch) {
      return { type: "dollar", start: cursorPos - dollarMatch[0].length, query: dollarMatch[1] };
    }

    // 检测 @agent 触发 agent 补全
    const agentMatch = beforeCursor.match(/@agent\s+([\w-]*)$/);
    if (agentMatch) {
      return { type: "agent", start: cursorPos - agentMatch[1].length, query: agentMatch[1] };
    }

    return null;
  }, []);

  return { detect };
}
