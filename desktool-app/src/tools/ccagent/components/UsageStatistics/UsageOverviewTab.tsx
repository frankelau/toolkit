// UsageOverviewTab.tsx — 总览 tab
// 对齐 cc-gui UsageStatistics/UsageOverviewTab.tsx
// 从 UsageStatisticsSection.tsx 拆分

import { formatCost, formatTokens } from "../../utils";

export interface UsageOverviewTabProps {
  filteredCost: number;
  filteredCount: number;
  filteredInput: number;
  filteredOutput: number;
  totalCost: number;
  totalInput: number;
  totalOutput: number;
  onReset?: () => void;
}

export function UsageOverviewTab({
  filteredCost, filteredCount, filteredInput, filteredOutput,
  totalCost, totalInput, totalOutput, onReset,
}: UsageOverviewTabProps) {
  return (
    <div className="cc-usage-overview">
      <div className="cc-usage-stat-grid">
        <div className="cc-usage-stat-item">
          <div className="cc-usage-stat-label">总花费</div>
          <div className="cc-usage-stat-value">${formatCost(filteredCost)}</div>
        </div>
        <div className="cc-usage-stat-item">
          <div className="cc-usage-stat-label">会话数</div>
          <div className="cc-usage-stat-value">{filteredCount}</div>
        </div>
        <div className="cc-usage-stat-item">
          <div className="cc-usage-stat-label">输入 tokens</div>
          <div className="cc-usage-stat-value">{formatTokens(filteredInput)}</div>
        </div>
        <div className="cc-usage-stat-item">
          <div className="cc-usage-stat-label">输出 tokens</div>
          <div className="cc-usage-stat-value">{formatTokens(filteredOutput)}</div>
        </div>
        <div className="cc-usage-stat-item">
          <div className="cc-usage-stat-label">平均花费/会话</div>
          <div className="cc-usage-stat-value">${formatCost(filteredCount > 0 ? filteredCost / filteredCount : 0)}</div>
        </div>
        <div className="cc-usage-stat-item">
          <div className="cc-usage-stat-label">总花费（全部）</div>
          <div className="cc-usage-stat-value">${formatCost(totalCost)}</div>
        </div>
        <div className="cc-usage-stat-item">
          <div className="cc-usage-stat-label">总输入 tokens（全部）</div>
          <div className="cc-usage-stat-value">{formatTokens(totalInput)}</div>
        </div>
        <div className="cc-usage-stat-item">
          <div className="cc-usage-stat-label">总输出 tokens（全部）</div>
          <div className="cc-usage-stat-value">{formatTokens(totalOutput)}</div>
        </div>
      </div>
      {onReset && (
        <button className="cc-usage-reset" onClick={onReset}>
          🗑️ 重置统计
        </button>
      )}
    </div>
  );
}

export default UsageOverviewTab;
