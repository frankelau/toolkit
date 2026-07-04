// 使用统计详情弹窗 — Phase 8
// 4 个 tab：总览 / 模型 / 会话 / 时间线

import { useState, useEffect, useMemo } from "react";
import { formatCost, formatTokens } from "../../utils";
import type { ChatMessage } from "../../types";

export interface SessionRecord {
  sessionId: string;
  project: string;
  summary: string;
  startedAt?: number;
  endedAt?: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  messageCount: number;
  model?: string;
}

interface UsageStatisticsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  totalCost: number;
  totalInput: number;
  totalOutput: number;
  totalSessions: number;
  messages: ChatMessage[];
  sessions: SessionRecord[];
  onReset?: () => void;
}

type Tab = "overview" | "models" | "sessions" | "timeline";

export function UsageStatisticsDialog({
  isOpen, onClose,
  totalCost, totalInput, totalOutput, totalSessions,
  messages, sessions, onReset,
}: UsageStatisticsDialogProps) {
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const modelStats = useMemo(() => {
    const map = new Map<string, { cost: number; input: number; output: number; count: number }>();
    sessions.forEach(s => {
      const m = s.model || "unknown";
      const cur = map.get(m) ?? { cost: 0, input: 0, output: 0, count: 0 };
      cur.cost += s.cost;
      cur.input += s.inputTokens;
      cur.output += s.outputTokens;
      cur.count += 1;
      map.set(m, cur);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].cost - a[1].cost);
  }, [sessions]);

  const timeline = useMemo(() => {
    // 按天聚合
    const map = new Map<string, { cost: number; input: number; output: number; count: number }>();
    sessions.forEach(s => {
      if (!s.startedAt) return;
      const day = new Date(s.startedAt).toISOString().slice(0, 10);
      const cur = map.get(day) ?? { cost: 0, input: 0, output: 0, count: 0 };
      cur.cost += s.cost;
      cur.input += s.inputTokens;
      cur.output += s.outputTokens;
      cur.count += 1;
      map.set(day, cur);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-30);
  }, [sessions]);

  if (!isOpen) return null;

  const avgCostPerSession = totalSessions > 0 ? totalCost / totalSessions : 0;
  const maxDayCost = Math.max(...timeline.map(t => t[1].cost), 0.01);

  return (
    <div className="cc-perm-overlay" onClick={onClose}>
      <div className="cc-usage-dialog" onClick={e => e.stopPropagation()}>
        <div className="cc-perm-title">
          <span>📈 使用统计</span>
          <button className="cc-ctx-close" onClick={onClose}>×</button>
        </div>

        <div className="cc-usage-tabs">
          {(["overview", "models", "sessions", "timeline"] as Tab[]).map(t => (
            <button
              key={t}
              className={`cc-usage-tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {{ overview: "总览", models: "模型", sessions: "会话", timeline: "时间线" }[t]}
            </button>
          ))}
        </div>

        <div className="cc-usage-body">
          {tab === "overview" && (
            <>
              <div className="cc-usage-stat-grid">
                <div className="cc-usage-stat-item">
                  <div className="cc-usage-stat-label">总花费</div>
                  <div className="cc-usage-stat-value">{formatCost(totalCost)}</div>
                </div>
                <div className="cc-usage-stat-item">
                  <div className="cc-usage-stat-label">总会话数</div>
                  <div className="cc-usage-stat-value">{totalSessions}</div>
                </div>
                <div className="cc-usage-stat-item">
                  <div className="cc-usage-stat-label">输入 tokens</div>
                  <div className="cc-usage-stat-value">{formatTokens(totalInput)}</div>
                </div>
                <div className="cc-usage-stat-item">
                  <div className="cc-usage-stat-label">输出 tokens</div>
                  <div className="cc-usage-stat-value">{formatTokens(totalOutput)}</div>
                </div>
                <div className="cc-usage-stat-item">
                  <div className="cc-usage-stat-label">平均每会话花费</div>
                  <div className="cc-usage-stat-value">{formatCost(avgCostPerSession)}</div>
                </div>
                <div className="cc-usage-stat-item">
                  <div className="cc-usage-stat-label">当前会话消息数</div>
                  <div className="cc-usage-stat-value">{messages.length}</div>
                </div>
              </div>
              {onReset && (
                <div className="cc-usage-reset-row">
                  <button className="cc-usage-reset" onClick={() => {
                    if (confirm("确认重置所有累计统计？此操作不可撤销。")) onReset();
                  }}>重置累计统计</button>
                </div>
              )}
            </>
          )}

          {tab === "models" && (
            <div className="cc-usage-table">
              {modelStats.length === 0 ? (
                <div className="cc-usage-empty">暂无数据</div>
              ) : (
                <table>
                  <thead>
                    <tr><th>模型</th><th>会话数</th><th>输入</th><th>输出</th><th>花费</th></tr>
                  </thead>
                  <tbody>
                    {modelStats.map(([m, s]) => (
                      <tr key={m}>
                        <td><code>{m}</code></td>
                        <td>{s.count}</td>
                        <td>{formatTokens(s.input)}</td>
                        <td>{formatTokens(s.output)}</td>
                        <td>{formatCost(s.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "sessions" && (
            <div className="cc-usage-sessions">
              {sessions.length === 0 ? (
                <div className="cc-usage-empty">暂无历史会话</div>
              ) : (
                sessions.slice().reverse().map(s => (
                  <div key={s.sessionId} className="cc-usage-session">
                    <div className="cc-usage-session-summary">{s.summary || "(无摘要)"}</div>
                    <div className="cc-usage-session-meta">
                      <span>{s.model && <code>{s.model}</code>}</span>
                      <span>💬 {s.messageCount}</span>
                      <span>📥 {formatTokens(s.inputTokens)}</span>
                      <span>📤 {formatTokens(s.outputTokens)}</span>
                      <span>💰 {formatCost(s.cost)}</span>
                      {s.startedAt && <span className="cc-usage-session-time">{new Date(s.startedAt).toLocaleString()}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "timeline" && (
            <div className="cc-usage-timeline">
              {timeline.length === 0 ? (
                <div className="cc-usage-empty">暂无时间线数据</div>
              ) : (
                timeline.map(([day, s]) => (
                  <div key={day} className="cc-usage-tl-row">
                    <span className="cc-usage-tl-day">{day}</span>
                    <div className="cc-usage-tl-bar-wrap">
                      <div className="cc-usage-tl-bar" style={{ width: `${(s.cost / maxDayCost) * 100}%` }} />
                    </div>
                    <span className="cc-usage-tl-cost">{formatCost(s.cost)}</span>
                    <span className="cc-usage-tl-count">{s.count} 会话</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
