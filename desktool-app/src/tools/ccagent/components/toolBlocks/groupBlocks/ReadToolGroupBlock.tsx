// ReadToolGroupBlock — 连续 Read 调用合并展示

import { useState } from "react";
import type { ToolGroupBlockProps } from "./shared";
import { getInputString, getFileName } from "../shared";

export function ReadToolGroupBlock({ items, defaultExpandedIndex }: ToolGroupBlockProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(defaultExpandedIndex ?? null);
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="cc-tb-group cc-tb-group-read" onClick={() => setCollapsed(false)}>
        <span className="cc-tb-group-icon">📖</span>
        <span className="cc-tb-group-name">读取 × {items.length}</span>
        <span className="cc-tb-group-toggle">展开 ▼</span>
      </div>
    );
  }

  return (
    <div className="cc-tb-group cc-tb-group-read">
      <div className="cc-tb-group-header" onClick={() => setCollapsed(true)}>
        <span className="cc-tb-group-icon">📖</span>
        <span className="cc-tb-group-name">读取 × {items.length}</span>
        <span className="cc-tb-group-toggle">收起 ▲</span>
      </div>
      <div className="cc-tb-group-list">
        {items.map(({ tool, index }) => {
          const filePath = getInputString(tool.input, "file_path") ?? "";
          const fileName = getFileName(filePath);
          const isExpanded = expandedIdx === index;
          return (
            <div key={tool.id} className={`cc-tb-group-item ${tool.isError ? "error" : ""} ${tool.isPending ? "pending" : ""}`}>
              <div className="cc-tb-group-item-head" onClick={() => setExpandedIdx(isExpanded ? null : index)}>
                <span className="cc-tb-group-item-icon">
                  {tool.isPending ? "⏳" : tool.isError ? "❌" : "✓"}
                </span>
                <span className="cc-tb-group-item-file">{fileName}</span>
                <span className="cc-tb-group-item-chevron">{isExpanded ? "▼" : "▶"}</span>
              </div>
              {isExpanded && tool.result && (
                <pre className="cc-tb-group-item-result">{tool.result.slice(0, 2000)}</pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
