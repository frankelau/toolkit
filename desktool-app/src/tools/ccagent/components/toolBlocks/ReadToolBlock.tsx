// Read 工具块 — 文件读取可视化

import { useState } from "react";
import type { ToolBlockProps } from "./shared";
import { ToolStatusIcon, getInputString, getInputNumber, getResultText, truncate, getFileName } from "./shared";

export function ReadToolBlock({ tool }: ToolBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const filePath = getInputString(tool.input, "file_path");
  const offset = getInputNumber(tool.input, "offset");
  const limit = getInputNumber(tool.input, "limit");
  const content = getResultText(tool.result);
  const fileName = getFileName(filePath);

  const lineInfo = offset && limit ? `${offset}-${offset + limit - 1} 行` : "";

  return (
    <div className={`cc-tb cc-tb-read ${tool.isPending ? "cc-tb-pending" : ""} ${tool.isError ? "cc-tb-error" : ""}`}>
      <div className="cc-tb-header" onClick={() => setExpanded(e => !e)}>
        <ToolStatusIcon tool={tool} />
        <span className="cc-tb-icon">📖</span>
        <span className="cc-tb-name">读取文件</span>
        <span className="cc-tb-file" title={filePath}>{fileName}</span>
        {lineInfo && <span className="cc-tb-line-info">{lineInfo}</span>}
        <span className="cc-tb-expand">{expanded ? "▼" : "▶"}</span>
      </div>
      {expanded && (
        <div className="cc-tb-body">
          <div className="cc-tb-params">
            <div className="cc-tb-param"><span className="cc-tb-param-key">file_path:</span> {filePath}</div>
            {offset && <div className="cc-tb-param"><span className="cc-tb-param-key">offset:</span> {offset}</div>}
            {limit && <div className="cc-tb-param"><span className="cc-tb-param-key">limit:</span> {limit}</div>}
          </div>
          {content && (
            <div className="cc-tb-read-content">
              <pre>{truncate(content)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
