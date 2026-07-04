// 搜索工具块 — Grep/Glob/WebSearch/WebFetch 可视化

import { useState } from "react";
import type { ToolBlockProps } from "./shared";
import { ToolStatusIcon, getInputString, truncate } from "./shared";

export function SearchToolBlock({ tool }: ToolBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const isGrep = tool.name === "Grep";
  const isGlob = tool.name === "Glob";
  const isWebSearch = tool.name === "WebSearch";

  const query = getInputString(tool.input, "pattern")
    || getInputString(tool.input, "query")
    || getInputString(tool.input, "glob");
  const url = getInputString(tool.input, "url");
  const path = getInputString(tool.input, "path") || getInputString(tool.input, "glob");
  const output = tool.result ?? "";

  const icon = isGrep ? "🔎" : isGlob ? "📁" : isWebSearch ? "🔍" : "🌐";
  const name = isGrep ? "Grep 搜索" : isGlob ? "Glob 匹配" : isWebSearch ? "网页搜索" : "网页获取";
  const summary = query || url || path || "";

  return (
    <div className={`cc-tb cc-tb-search ${tool.isPending ? "cc-tb-pending" : ""} ${tool.isError ? "cc-tb-error" : ""}`}>
      <div className="cc-tb-header" onClick={() => setExpanded(e => !e)}>
        <ToolStatusIcon tool={tool} />
        <span className="cc-tb-icon">{icon}</span>
        <span className="cc-tb-name">{name}</span>
        {summary && <span className="cc-tb-desc">{summary.slice(0, 60)}</span>}
        <span className="cc-tb-expand">{expanded ? "▼" : "▶"}</span>
      </div>
      {expanded && (
        <div className="cc-tb-body">
          <div className="cc-tb-params">
            {query && <div className="cc-tb-param"><span className="cc-tb-param-key">{isGrep ? "pattern" : "query"}:</span> {query}</div>}
            {url && <div className="cc-tb-param"><span className="cc-tb-param-key">url:</span> {url}</div>}
            {path && <div className="cc-tb-param"><span className="cc-tb-param-key">path:</span> {path}</div>}
          </div>
          {output && (
            <div className="cc-tb-search-result">
              <pre>{truncate(output, 3000)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
