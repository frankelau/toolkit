// Agent 工具块 — 子 Agent 调用可视化

import { useState } from "react";
import type { ToolBlockProps } from "./shared";
import { ToolStatusIcon, getInputString, truncate } from "./shared";

export function AgentToolBlock({ tool }: ToolBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const description = getInputString(tool.input, "description");
  const prompt = getInputString(tool.input, "prompt");
  const subagentType = getInputString(tool.input, "subagent_type");
  const output = tool.result ?? "";

  return (
    <div className={`cc-tb cc-tb-agent ${tool.isPending ? "cc-tb-pending" : ""} ${tool.isError ? "cc-tb-error" : ""}`}>
      <div className="cc-tb-header" onClick={() => setExpanded(e => !e)}>
        <ToolStatusIcon tool={tool} />
        <span className="cc-tb-icon">🤖</span>
        <span className="cc-tb-name">子 Agent{subagentType ? ` · ${subagentType}` : ""}</span>
        {description && <span className="cc-tb-desc">{description.slice(0, 60)}</span>}
        {tool.isPending && <span className="cc-tb-agent-spin">↺</span>}
        <span className="cc-tb-expand">{expanded ? "▼" : "▶"}</span>
      </div>
      {expanded && (
        <div className="cc-tb-body">
          <div className="cc-tb-params">
            {subagentType && <div className="cc-tb-param"><span className="cc-tb-param-key">type:</span> {subagentType}</div>}
            {description && <div className="cc-tb-param"><span className="cc-tb-param-key">description:</span> {description}</div>}
            {prompt && (
              <div className="cc-tb-param cc-tb-param-prompt">
                <span className="cc-tb-param-key">prompt:</span>
                <pre>{truncate(prompt, 2000)}</pre>
              </div>
            )}
          </div>
          {output && (
            <div className="cc-tb-agent-result">
              <span className="cc-tb-label">结果</span>
              <pre>{truncate(output, 3000)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
