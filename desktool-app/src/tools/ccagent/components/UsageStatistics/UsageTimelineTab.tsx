// UsageTimelineTab.tsx — 时间线 tab
// 对齐 cc-gui UsageStatistics/UsageTimelineTab.tsx

import { formatCost } from "../../utils";
import type { DailyUsage } from "./useUsageStatistics";

export interface UsageTimelineTabProps {
  dailyUsage: DailyUsage[];
  maxDailyCost: number;
}

export function UsageTimelineTab({ dailyUsage, maxDailyCost }: UsageTimelineTabProps) {
  if (dailyUsage.length === 0) return <div className="cc-usage-empty">暂无数据</div>;

  return (
    <div className="cc-usage-timeline">
      <div className="cc-usage-timeline-chart">
        {dailyUsage.map(d => (
          <div key={d.day} className="cc-usage-timeline-bar" title={`${d.day}: $${formatCost(d.cost)} (${d.count} 次会话)`}>
            <div
              className="cc-usage-timeline-bar-fill"
              style={{ height: `${(d.cost / maxDailyCost) * 100}%` }}
            />
            <div className="cc-usage-timeline-bar-label">{d.day.slice(5)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default UsageTimelineTab;
