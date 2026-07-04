// SearchToolGroupBlock — 连续 Grep/Glob/WebSearch/WebFetch 合并展示

import { useState } from "react";
import type { ToolGroupBlockProps } from "./shared";
import { getInputString, truncate } from "../shared";

export function SearchToolGroupBlock({ items, defaultExpandedIndex }: ToolGroupBlockProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(defaultExpandedIndex ?? null);
  const [collapsed, setCollapsed] = useState(false);

  const queries = items.map(i => {
    return getInputString(i.tool.input, "pattern")
      || getInputString(i.tool.input, "query")
      || getInputString(i.tool.input, "glob")
      || getInputString(i.tool.input, "url")
      || "";
  }).filter(Boolean);

  if (collapsed) {
    return (
      <div className="cc-tb-group cc-tb-group-search" onClick={() => setCollapsed(false)}>
        <span className="cc-tb-group-icon">🔎</span>
        <span className="cc-tb-group-name">搜索 × {items.length}</span>
        <span className="cc-tb-group-toggle">展开 ▼</span>
      </div>
    );
  }

  return (
    <div className="cc-tb-group cc-tb-group-search">
      <div className="cc-tb-group-header" onClick={() => setCollapsed(true)}>
        <span className="cc-tb-group-icon">🔎</span>
        <span className="cc-tb-group-name">搜索 × {items.length}</span>
        <span className="cc-tb-group-toggle">收起 ▲</span>
      </div>
      <div className="cc-tb-group-list">
        {items.map(({ tool, index }) => {
          const query = queries[index] ?? "";
          const isExpanded = expandedIdx === index;
          const icon = tool.name === "WebFetch" ? "🌐" : tool.name === "WebSearch" ? "🔍" : tool.name === "Glob" ? "📁" : "🔎";
          return (
            <div key={tool.id} className={`cc-tb-group-item ${tool.isError ? "error" : ""} ${tool.isPending ? "pending" : ""}`}>
              <div className="cc-tb-group-item-head" onClick={() => setExpandedIdx(isExpanded ? null : index)}>
                <span className="cc-tb-group-item-icon">{tool.isPending ? "⏳" : tool.isError ? "❌" : icon}</span>
                <code className="cc-tb-group-item-cmd">{truncate(query, 60)}</code>
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
