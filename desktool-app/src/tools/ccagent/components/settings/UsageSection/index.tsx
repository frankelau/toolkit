// UsageSection/index.tsx — 使用统计设置区
// 对齐 cc-gui 的 UsageSection/index.tsx
// 嵌入 UsageStatisticsSection，提供数据加载和刷新

import { useState, useEffect, useCallback } from "react";
import type { SessionUsageRecord } from "../../../types";
import { UsageStatisticsSection } from "../../UsageStatistics";
import { RefreshIcon } from "../../Icons";

const STORAGE_KEY = "ccagent:sessionRecords";

interface UsageSectionProps {
  currentProvider?: string;
}

function loadSessionRecords(): SessionUsageRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function UsageSection({ currentProvider }: UsageSectionProps) {
  const [sessions, setSessions] = useState<SessionUsageRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSessions(loadSessionRecords());
  }, []);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    // 重新从 localStorage 读取（实际场景可调后端）
    setTimeout(() => {
      setSessions(loadSessionRecords());
      setLoading(false);
    }, 300);
  }, []);

  const handleReset = useCallback(() => {
    if (!confirm("确定要重置所有使用统计数据吗？此操作不可撤销。")) return;
    localStorage.removeItem(STORAGE_KEY);
    setSessions([]);
  }, []);

  // 计算总量
  const totalCost = sessions.reduce((sum, s) => sum + s.costUsd, 0);
  const totalInput = sessions.reduce((sum, s) => sum + s.inputTokens, 0);
  const totalOutput = sessions.reduce((sum, s) => sum + s.outputTokens, 0);

  return (
    <div className="cc-usage-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>使用统计</h4>
        <button
          onClick={handleRefresh}
          style={{
            background: "none",
            border: "1px solid var(--border, #555)",
            borderRadius: "4px",
            color: "var(--text-muted, #aaa)",
            cursor: "pointer",
            padding: "4px 8px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "12px",
          }}
          disabled={loading}
        >
          <RefreshIcon size={14} className={loading ? "cc-spin" : ""} />
          刷新
        </button>
      </div>

      {sessions.length === 0 ? (
        <div style={{
          padding: "40px",
          textAlign: "center",
          color: "var(--text-muted, #888)",
          fontSize: "13px",
        }}>
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>📊</div>
          暂无使用统计数据
          <div style={{ fontSize: "11px", marginTop: "4px" }}>
            开始使用 AI 后将自动记录
          </div>
        </div>
      ) : (
        <UsageStatisticsSection
          totalCost={totalCost}
          totalInput={totalInput}
          totalOutput={totalOutput}
          sessions={sessions}
          currentProvider={currentProvider}
          loading={loading}
          onRefresh={handleRefresh}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
