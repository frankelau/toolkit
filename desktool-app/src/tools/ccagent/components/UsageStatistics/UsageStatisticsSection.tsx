// UsageStatisticsSection — 使用统计独立区块
// 对齐 cc-gui UsageStatisticsSection.tsx
// Sprint O3: 拆分为目录，4 个 tab + hook 独立文件

import { RefreshIcon } from "../Icons";
import type { UsageStatisticsSectionProps } from "./UsageStatisticsSection.types";
import {
  useUsageStatistics, formatRelativeTime,
} from "./useUsageStatistics";
import { UsageOverviewTab } from "./UsageOverviewTab";
import { UsageModelsTab } from "./UsageModelsTab";
import { UsageSessionsTab } from "./UsageSessionsTab";
import { UsageTimelineTab } from "./UsageTimelineTab";

export type { UsageStatisticsSectionProps } from "./UsageStatisticsSection.types";

export function UsageStatisticsSection({
  totalCost, totalInput, totalOutput, sessions, loading = false, onRefresh, onReset,
}: UsageStatisticsSectionProps) {
  const {
    activeTab, setActiveTab, dateRange, setDateRange,
    filteredSessions, byModel, dailyUsage,
    filteredCost, filteredInput, filteredOutput, filteredCount, maxDailyCost,
  } = useUsageStatistics(sessions);

  return (
    <div className="cc-usage-statistics-section">
      <div className="cc-notice-box cc-notice-warning">
        <span>⚠️</span>
        费用为估算值，基于模型标价计算，仅供参考
      </div>

      <div className="cc-usage-controls">
        <div className="cc-controls-left">
          <div className="cc-date-range-selector">
            <button className={`cc-range-btn ${dateRange === "7d" ? "active" : ""}`} onClick={() => setDateRange("7d")}>近 7 天</button>
            <button className={`cc-range-btn ${dateRange === "30d" ? "active" : ""}`} onClick={() => setDateRange("30d")}>近 30 天</button>
            <button className={`cc-range-btn ${dateRange === "all" ? "active" : ""}`} onClick={() => setDateRange("all")}>全部</button>
          </div>
        </div>
        <button onClick={onRefresh} className="cc-refresh-btn" disabled={loading} title="刷新数据">
          <RefreshIcon size={16} className={loading ? "cc-spin" : ""} />
        </button>
      </div>

      <div className="cc-usage-tabs">
        <button className={`cc-tab-btn ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>📊 总览</button>
        <button className={`cc-tab-btn ${activeTab === "models" ? "active" : ""}`} onClick={() => setActiveTab("models")}>🤖 模型</button>
        <button className={`cc-tab-btn ${activeTab === "sessions" ? "active" : ""}`} onClick={() => setActiveTab("sessions")}>📋 会话</button>
        <button className={`cc-tab-btn ${activeTab === "timeline" ? "active" : ""}`} onClick={() => setActiveTab("timeline")}>📈 时间线</button>
      </div>

      <div className="cc-usage-content">
        {activeTab === "overview" && (
          <UsageOverviewTab
            filteredCost={filteredCost}
            filteredCount={filteredCount}
            filteredInput={filteredInput}
            filteredOutput={filteredOutput}
            totalCost={totalCost}
            totalInput={totalInput}
            totalOutput={totalOutput}
            onReset={onReset}
          />
        )}
        {activeTab === "models" && <UsageModelsTab byModel={byModel} />}
        {activeTab === "sessions" && <UsageSessionsTab sessions={filteredSessions} />}
        {activeTab === "timeline" && (
          <UsageTimelineTab dailyUsage={dailyUsage} maxDailyCost={maxDailyCost} />
        )}
      </div>

      {sessions.length > 0 && (
        <div className="cc-last-updated">
          <span>🔄 最后更新：{formatRelativeTime(Math.max(...sessions.map(s => s.ts)))}</span>
        </div>
      )}
    </div>
  );
}

export default UsageStatisticsSection;
