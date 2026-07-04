// agentProvider — @agent 补全（对齐 cc-gui agentProvider）
// Sprint B: 触发 @ 字符后输入 agent 名，提供已创建的 Agent 列表

import type { CompletionItem } from "../hooks/useCompletionDropdown";
import type { AgentConfig } from "../../../types";

export function getAgentCompletions(
  query: string,
  agents: AgentConfig[],
): CompletionItem[] {
  const q = query.toLowerCase();
  return agents
    .filter(a => !q || a.name.toLowerCase().includes(q))
    .slice(0, 20)
    .map(a => ({
      id: a.id,
      label: a.name,
      description: (a.prompt || "").slice(0, 50),
      icon: "🤖",
      insertText: a.name,
      data: a,
    }));
}
