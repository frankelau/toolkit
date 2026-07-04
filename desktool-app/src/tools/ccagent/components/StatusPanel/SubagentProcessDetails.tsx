// SubagentProcessDetails — 子 Agent 执行详情展开面板

import { useState } from "react";
import type { SubagentInfo } from "../../types";
import { formatTokens } from "../../utils";
import { CollapsibleTextBlock } from "../CollapsibleTextBlock";

export interface SubagentProcessDetailsProps {
  subagent: SubagentInfo;
}

export function SubagentProcessDetails({ subagent }: SubagentProcessDetailsProps) {
  const [tab, setTab] = useState<"prompt" | "result" | "stats">("stats");

  const statusIcon = subagent.status === "running" ? "🔄" : subagent.status === "completed" ? "✓" : "✗";
  const statusColor = subagent.status === "running" ? "#4a9" : subagent.status === "completed" ? "#6c6" : "#e55";

  return (
    <div className="cc-subagent-details">
      <div className="cc-subagent-stats">
        <span className="cc-subagent-stat" style={{ color: statusColor }}>
          {statusIcon} {subagent.status}
        </span>
        {subagent.totalDurationMs != null && (
          <span className="cc-subagent-stat">⏱ {(subagent.totalDurationMs / 1000).toFixed(1)}s</span>
        )}
        {subagent.totalTokens != null && (
          <span className="cc-subagent-stat">🔢 {formatTokens(subagent.totalTokens)}</span>
        )}
        {subagent.totalToolUseCount != null && (
          <span className="cc-subagent-stat">🔧 {subagent.totalToolUseCount}</span>
        )}
      </div>

      <div className="cc-subagent-tabs">
        <button
          className={`cc-subagent-tab ${tab === "stats" ? "active" : ""}`}
          onClick={() => setTab("stats")}
        >统计</button>
        {subagent.prompt && (
          <button
            className={`cc-subagent-tab ${tab === "prompt" ? "active" : ""}`}
            onClick={() => setTab("prompt")}
          >Prompt</button>
        )}
        {subagent.resultText && (
          <button
            className={`cc-subagent-tab ${tab === "result" ? "active" : ""}`}
            onClick={() => setTab("result")}
          >结果</button>
        )}
      </div>

      {tab === "prompt" && subagent.prompt && (
        <CollapsibleTextBlock
          content={subagent.prompt}
          mono
          maxHeight={200}
          title="子 Agent Prompt"
        />
      )}

      {tab === "result" && subagent.resultText && (
        <CollapsibleTextBlock
          content={subagent.resultText}
          maxHeight={300}
          title="子 Agent 结果"
        />
      )}

      {tab === "stats" && (
        <div className="cc-subagent-stats-detail">
          <div className="cc-subagent-stat-row">
            <span className="cc-subagent-stat-label">类型</span>
            <span className="cc-subagent-stat-value">{subagent.type}</span>
          </div>
          <div className="cc-subagent-stat-row">
            <span className="cc-subagent-stat-label">描述</span>
            <span className="cc-subagent-stat-value">{subagent.description}</span>
          </div>
          <div className="cc-subagent-stat-row">
            <span className="cc-subagent-stat-label">状态</span>
            <span className="cc-subagent-stat-value" style={{ color: statusColor }}>{subagent.status}</span>
          </div>
          {subagent.totalDurationMs != null && (
            <div className="cc-subagent-stat-row">
              <span className="cc-subagent-stat-label">耗时</span>
              <span className="cc-subagent-stat-value">{(subagent.totalDurationMs / 1000).toFixed(2)}s</span>
            </div>
          )}
          {subagent.totalTokens != null && (
            <div className="cc-subagent-stat-row">
              <span className="cc-subagent-stat-label">Tokens</span>
              <span className="cc-subagent-stat-value">{formatTokens(subagent.totalTokens)}</span>
            </div>
          )}
          {subagent.totalToolUseCount != null && (
            <div className="cc-subagent-stat-row">
              <span className="cc-subagent-stat-label">工具调用</span>
              <span className="cc-subagent-stat-value">{subagent.totalToolUseCount}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
