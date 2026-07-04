// useSubagents — 子 Agent 状态追踪（对齐 cc-gui useSubagents）
// Sprint A: 从工具调用中提取 Agent/Task/Explore 调用，构建 SubagentInfo

import { useMemo } from "react";
import type { ChatMessage, SubagentInfo } from "../types";

interface UseSubagentsOptions {
  messages: ChatMessage[];
}

export function useSubagents({ messages }: UseSubagentsOptions) {
  const subagents = useMemo<SubagentInfo[]>(() => {
    const list: SubagentInfo[] = [];
    let current: SubagentInfo | null = null;

    for (const msg of messages) {
      if (!msg.toolUses) continue;
      for (const tool of msg.toolUses) {
        if (isAgentTool(tool.name)) {
          // 新 Agent 调用
          if (current) list.push(current);
          current = {
            id: tool.id,
            type: tool.name,
            description: (tool.input.description as string) || (tool.input.subagent_type as string) || tool.name,
            prompt: tool.input.prompt as string | undefined,
            status: tool.isPending ? "running" : tool.isError ? "error" : "completed",
          };
        } else if (current && current.id === tool.id) {
          // 当前 Agent 的结果
          if (tool.result) {
            current.resultText = tool.result.slice(0, 2000);
          }
          current.status = tool.isError ? "error" : "completed";
        }
      }
    }
    if (current) list.push(current);
    return list;
  }, [messages]);

  const runningCount = subagents.filter(s => s.status === "running").length;
  const completedCount = subagents.filter(s => s.status === "completed").length;
  const errorCount = subagents.filter(s => s.status === "error").length;

  return {
    subagents,
    runningCount,
    completedCount,
    errorCount,
    totalCount: subagents.length,
  };
}

function isAgentTool(name: string): boolean {
  return ["Agent", "Task", "Explore", "LaunchSubagent"].includes(name);
}
