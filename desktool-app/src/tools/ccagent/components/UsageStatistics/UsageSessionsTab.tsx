// UsageSessionsTab.tsx — 会话列表 tab
// 对齐 cc-gui UsageStatistics/UsageSessionsTab.tsx

import { formatCost, formatTokens } from "../../utils";
import { formatRelativeTime } from "./useUsageStatistics";
import type { SessionUsageRecord } from "../../types";

export interface UsageSessionsTabProps {
  sessions: SessionUsageRecord[];
}

export function UsageSessionsTab({ sessions }: UsageSessionsTabProps) {
  if (sessions.length === 0) return <div className="cc-usage-empty">暂无会话记录</div>;

  return (
    <div className="cc-usage-sessions">
      <div className="cc-usage-session-list">
        {sessions.slice().reverse().map(s => (
          <div key={s.sessionId} className="cc-usage-session-item">
            <div className="cc-usage-session-summary">{s.summary || "(无摘要)"}</div>
            <div className="cc-usage-session-meta">
              <span className="cc-usage-session-model">{s.model || "unknown"}</span>
              <span className="cc-usage-session-tokens">
                ↑{formatTokens(s.inputTokens)} ↓{formatTokens(s.outputTokens)}
              </span>
              <span className="cc-usage-session-cost">${formatCost(s.costUsd)}</span>
              <span className="cc-usage-session-time">{formatRelativeTime(s.ts)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default UsageSessionsTab;
