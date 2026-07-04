// useUsageStatistics.ts — 使用统计数据 hook
// 对齐 cc-gui UsageStatistics/useUsageStatistics.ts
// 从 UsageStatisticsSection.tsx 拆分：数据过滤/聚合逻辑

import { useMemo, useState } from "react";
import type { SessionUsageRecord } from "../../types";

export type Tab = "overview" | "models" | "sessions" | "timeline";
export type DateRange = "7d" | "30d" | "all";

const NOW = Date.now;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ModelUsage {
  model: string;
  cost: number;
  input: number;
  output: number;
  count: number;
}

export interface DailyUsage {
  day: string;
  cost: number;
  count: number;
}

export interface UsageStatisticsState {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  filteredSessions: SessionUsageRecord[];
  byModel: ModelUsage[];
  dailyUsage: DailyUsage[];
  filteredCost: number;
  filteredInput: number;
  filteredOutput: number;
  filteredCount: number;
  maxDailyCost: number;
}

export function useUsageStatistics(sessions: SessionUsageRecord[]): UsageStatisticsState {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [dateRange, setDateRange] = useState<DateRange>("all");

  const filteredSessions = useMemo(() => {
    if (dateRange === "all") return sessions;
    const days = dateRange === "7d" ? 7 : 30;
    const cutoff = NOW() - days * DAY_MS;
    return sessions.filter(s => s.ts >= cutoff);
  }, [sessions, dateRange]);

  const byModel = useMemo(() => {
    const map = new Map<string, ModelUsage>();
    for (const s of filteredSessions) {
      const key = s.model || "unknown";
      const existing = map.get(key) || { model: key, cost: 0, input: 0, output: 0, count: 0 };
      existing.cost += s.costUsd;
      existing.input += s.inputTokens;
      existing.output += s.outputTokens;
      existing.count += 1;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [filteredSessions]);

  const dailyUsage = useMemo(() => {
    const map = new Map<string, DailyUsage>();
    for (const s of filteredSessions) {
      const d = new Date(s.ts);
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const existing = map.get(day) || { day, cost: 0, count: 0 };
      existing.cost += s.costUsd;
      existing.count += 1;
      map.set(day, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [filteredSessions]);

  const filteredCost = filteredSessions.reduce((sum, s) => sum + s.costUsd, 0);
  const filteredInput = filteredSessions.reduce((sum, s) => sum + s.inputTokens, 0);
  const filteredOutput = filteredSessions.reduce((sum, s) => sum + s.outputTokens, 0);
  const filteredCount = filteredSessions.length;
  const maxDailyCost = Math.max(0.01, ...dailyUsage.map(d => d.cost));

  return {
    activeTab, setActiveTab, dateRange, setDateRange,
    filteredSessions, byModel, dailyUsage,
    filteredCost, filteredInput, filteredOutput, filteredCount, maxDailyCost,
  };
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatRelativeTime(ts: number): string {
  const diff = NOW() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds} 秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return formatDate(ts);
}
