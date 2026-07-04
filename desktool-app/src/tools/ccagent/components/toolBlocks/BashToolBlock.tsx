// Bash 工具块 — 命令执行可视化

import { useState } from "react";
import { copyText } from "../../../../useCopyFeedback";
import type { ToolBlockProps } from "./shared";
import { ToolStatusIcon, getInputString, truncate } from "./shared";

export function BashToolBlock({ tool }: ToolBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const command = getInputString(tool.input, "command");
  const description = getInputString(tool.input, "description");
  const output = tool.result ?? "";

  return (
    <div className={`cc-tb cc-tb-bash ${tool.isPending ? "cc-tb-pending" : ""} ${tool.isError ? "cc-tb-error" : ""}`}>
      <div className="cc-tb-header" onClick={() => setExpanded(e => !e)}>
        <ToolStatusIcon tool={tool} />
        <span className="cc-tb-icon">⚡</span>
        <span className="cc-tb-name">终端命令</span>
        {description && <span className="cc-tb-desc">{description}</span>}
        <span className="cc-tb-cmd-preview">{command.slice(0, 60)}{command.length > 60 ? "…" : ""}</span>
        <span className="cc-tb-expand">{expanded ? "▼" : "▶"}</span>
      </div>
      {expanded && (
        <div className="cc-tb-body">
          <div className="cc-tb-bash-command">
            <span className="cc-tb-label">$ 命令</span>
            <pre className="cc-tb-bash-cmd-text">{command}</pre>
            <button className="cc-tb-copy" onClick={() => copyText(command)}>复制</button>
          </div>
          {output && (
            <div className={`cc-tb-bash-output ${tool.isError ? "cc-tb-output-error" : ""}`}>
              <span className="cc-tb-label">{tool.isError ? "✗ 错误输出" : "↳ 输出"}</span>
              <pre>{truncate(output)}</pre>
              <button className="cc-tb-copy" onClick={() => copyText(output)}>复制</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
