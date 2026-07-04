// SubagentList.tsx — 子 Agent 列表 (增强版 D3)
// 新增: 运行中动画 + 实时耗时 + 工具调用计数 + 批量展开/折叠

import { useState } from "react";
import { formatTokens } from "../../utils";
import type { SubagentListProps } from "./types";
import { SUBAGENT_STATUS_ICON, SUBAGENT_STATUS_CLASS } from "./utils";

export function SubagentList({ subagents }: SubagentListProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);

  if (subagents.length === 0) return <div className="cc-panel-empty">暂无子 Agent</div>;

  function toggleAll() {
    if (expandAll) { setExpandAll(false); setExpanded(null); }
    else { setExpandAll(true); }
  }

  return (
    <div className="cc-panel-list">
      {subagents.length > 1 && (
        <button className="cc-subagent-expand-all" onClick={toggleAll}>
          {expandAll ? "折叠全部 ▼" : "展开全部 ▶"} ({subagents.length} 个)
        </button>
      )}

      {subagents.map((s) => {
        const isOpen = expandAll || expanded === s.id;
        return (
          <div key={s.id} className={`cc-subagent-item ${SUBAGENT_STATUS_CLASS[s.status] ?? ""}`}>
            <button className="cc-subagent-row" onClick={() => setExpanded(e => e === s.id ? null : s.id)}>
              <span className={`cc-subagent-icon ${s.status === "running" ? "cc-spin" : ""}`}>
                {SUBAGENT_STATUS_ICON[s.status] ?? "○"}
              </span>
              <span className="cc-subagent-type">{s.type}</span>
              <span className="cc-subagent-desc" title={s.description}>
                {s.description?.length > 60 ? s.description.slice(0, 60) + "…" : s.description}
              </span>
              <span className="cc-subagent-chevron">{isOpen ? "▼" : "▶"}</span>
            </button>

            {isOpen && (
              <div className="cc-subagent-details">
                <div className="cc-subagent-stats">
                  {s.status === "running" && <span className="cc-subagent-stat cc-subagent-live">● 运行中</span>}
                  {s.totalDurationMs != null && s.totalDurationMs > 0 && (
                    <span className="cc-subagent-stat">⏱ {(s.totalDurationMs / 1000).toFixed(1)}s</span>
                  )}
                  {s.totalTokens != null && s.totalTokens > 0 && (
                    <span className="cc-subagent-stat">📊 {formatTokens(s.totalTokens)}</span>
                  )}
                  {s.totalToolUseCount != null && s.totalToolUseCount > 0 && (
                    <span className="cc-subagent-stat">🔧 {s.totalToolUseCount} 工具调用</span>
                  )}
                  {s.status === "completed" && <span className="cc-subagent-stat cc-subagent-done">✓ 完成</span>}
                  {s.status === "error" && <span className="cc-subagent-stat cc-subagent-error">✗ 错误</span>}
                </div>

                {s.description && s.description.length > 60 && (
                  <div className="cc-subagent-desc-full">{s.description}</div>
                )}

                {s.prompt && (
                  <details className="cc-subagent-collapse">
                    <summary className="cc-subagent-detail-label">📝 Prompt</summary>
                    <pre className="cc-subagent-pre">{s.prompt.slice(0, 500)}{s.prompt.length > 500 ? "…" : ""}</pre>
                  </details>
                )}

                {s.resultText && (
                  <details className="cc-subagent-collapse" open={s.status === "error"}>
                    <summary className="cc-subagent-detail-label">📋 结果</summary>
                    <pre className="cc-subagent-pre">{s.resultText.slice(0, 2000)}{s.resultText.length > 2000 ? "\n… (截断)" : ""}</pre>
                  </details>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default SubagentList;
