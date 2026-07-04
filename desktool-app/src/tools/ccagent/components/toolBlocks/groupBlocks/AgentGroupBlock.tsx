// AgentGroupBlock — 连续子 Agent 调用合并展示

import { useState } from "react";
import type { ToolGroupBlockProps } from "./shared";
import { getInputString, truncate } from "../shared";

export function AgentGroupBlock({ items, defaultExpandedIndex }: ToolGroupBlockProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(defaultExpandedIndex ?? null);
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="cc-tb-group cc-tb-group-agent" onClick={() => setCollapsed(false)}>
        <span className="cc-tb-group-icon">🤖</span>
        <span className="cc-tb-group-name">子Agent × {items.length}</span>
        <span className="cc-tb-group-toggle">展开 ▼</span>
      </div>
    );
  }

  return (
    <div className="cc-tb-group cc-tb-group-agent">
      <div className="cc-tb-group-header" onClick={() => setCollapsed(true)}>
        <span className="cc-tb-group-icon">🤖</span>
        <span className="cc-tb-group-name">子Agent × {items.length}</span>
        <span className="cc-tb-group-toggle">收起 ▲</span>
      </div>
      <div className="cc-tb-group-list">
        {items.map(({ tool, index }) => {
          const prompt = getInputString(tool.input, "prompt") ?? getInputString(tool.input, "description") ?? "";
          const subagentType = getInputString(tool.input, "subagent_type") ?? tool.name;
          const isExpanded = expandedIdx === index;
          return (
            <div key={tool.id} className={`cc-tb-group-item ${tool.isError ? "error" : ""} ${tool.isPending ? "pending" : ""}`}>
              <div className="cc-tb-group-item-head" onClick={() => setExpandedIdx(isExpanded ? null : index)}>
                <span className="cc-tb-group-item-icon">
                  {tool.isPending ? <span className="cc-tb-spin">🔄</span> : tool.isError ? "❌" : "✓"}
                </span>
                <span className="cc-tb-group-item-type">{subagentType}</span>
                <code className="cc-tb-group-item-cmd">{truncate(prompt, 60)}</code>
                <span className="cc-tb-group-item-chevron">{isExpanded ? "▼" : "▶"}</span>
              </div>
              {isExpanded && tool.result && (
                <pre className="cc-tb-group-item-result">{truncate(tool.result, 2000)}</pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
