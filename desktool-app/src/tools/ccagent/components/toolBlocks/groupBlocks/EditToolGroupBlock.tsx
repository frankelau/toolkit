// EditToolGroupBlock — 连续 Write/Edit/MultiEdit 调用合并展示
// 对齐 cc-gui: 文件级 diff + 增删统计 + 行号范围

import { useState, useMemo } from "react";
import type { ToolGroupBlockProps } from "./shared";
import { getInputString, getFileName } from "../shared";
import { DiffViewer } from "../../MessageItem";

export function EditToolGroupBlock({ items, defaultExpandedIndex = 0 }: ToolGroupBlockProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(defaultExpandedIndex);
  const [collapsed, setCollapsed] = useState(false);

  const fileStats = useMemo(() => {
    const map = new Map<string, { additions: number; deletions: number }>();
    for (const i of items) {
      const fp = getInputString(i.tool.input, "file_path") || "";
      if (!fp) continue;
      const ns = getInputString(i.tool.input, "new_string") || getInputString(i.tool.input, "content") || "";
      const os = getInputString(i.tool.input, "old_string") || "";
      const prev = map.get(fp) || { additions: 0, deletions: 0 };
      prev.additions += ns.split("\n").length || 0;
      prev.deletions += os.split("\n").length || 0;
      map.set(fp, prev);
    }
    return map;
  }, [items]);

  const uniqueFiles = fileStats.size;
  const totalAdds = [...fileStats.values()].reduce((s, v) => s + v.additions, 0);
  const totalDels = [...fileStats.values()].reduce((s, v) => s + v.deletions, 0);

  if (collapsed) {
    return (
      <div className="cc-tb-group cc-tb-group-edit" onClick={() => setCollapsed(false)}>
        <span className="cc-tb-group-icon">📝</span>
        <span className="cc-tb-group-name">编辑 × {items.length}</span>
        <span className="cc-tb-group-files">{uniqueFiles} 文件</span>
        <span className="cc-tb-group-stats"><span className="stat-add">+{totalAdds}</span> <span className="stat-del">-{totalDels}</span></span>
        <span className="cc-tb-group-toggle">展开 ▼</span>
      </div>
    );
  }

  return (
    <div className="cc-tb-group cc-tb-group-edit">
      <div className="cc-tb-group-header" onClick={() => setCollapsed(true)}>
        <span className="cc-tb-group-icon">📝</span>
        <span className="cc-tb-group-name">编辑 × {items.length}</span>
        <span className="cc-tb-group-files">{uniqueFiles} 文件</span>
        <span className="cc-tb-group-stats"><span className="stat-add">+{totalAdds}</span> <span className="stat-del">-{totalDels}</span></span>
        <span className="cc-tb-group-toggle">收起 ▲</span>
      </div>
      <div className="cc-tb-group-list">
        {items.map(({ tool, index }) => {
          const fp = getInputString(tool.input, "file_path") || "";
          const fn = getFileName(fp);
          const stats = fileStats.get(fp);
          const isExpanded = expandedIdx === index;
          const lineStart = getInputString(tool.input, "line_start");
          return (
            <div key={tool.id} className={`cc-tb-group-item ${tool.isError ? "error" : ""} ${tool.isPending ? "pending" : ""}`}>
              <div className="cc-tb-group-item-head" onClick={() => setExpandedIdx(isExpanded ? null : index)}>
                <span className="cc-tb-group-item-icon">
                  {tool.isPending ? "⏳" : tool.isError ? "❌" : "✓"}
                </span>
                <span className="cc-tb-group-item-file">{fn}</span>
                {lineStart && <span className="cc-tb-group-item-line">L{lineStart}</span>}
                {stats && <span className="cc-tb-group-item-stats"><span className="stat-add">+{stats.additions}</span> <span className="stat-del">-{stats.deletions}</span></span>}
                <span className="cc-tb-group-item-chevron">{isExpanded ? "▼" : "▶"}</span>
              </div>
              {isExpanded && tool.diff && <DiffViewer diff={tool.diff} />}
              {isExpanded && tool.result && (
                <pre className="cc-tb-group-item-result">{tool.result.slice(0, 500)}</pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
