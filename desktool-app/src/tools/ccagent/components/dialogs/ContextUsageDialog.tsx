// 上下文用量详情弹窗 — Phase 8
// 展示当前会话的上下文使用详情：各类别 token 占比、memory 文件、MCP 工具、agent、skills

import { useEffect } from "react";
import { formatTokens } from "../../utils";

export interface ContextCategory {
  name: string;
  tokens: number;
  color: string;
  isDeferred?: boolean;
}

export interface ContextUsageData {
  categories: ContextCategory[];
  totalTokens: number;
  maxTokens: number;
  percentage: number;
  model: string;
  memoryFiles?: { path: string; type: string; tokens: number }[];
  mcpTools?: { name: string; serverName: string; tokens: number }[];
  agents?: { agentType: string; source: string; tokens: number }[];
  skills?: {
    totalSkills: number;
    includedSkills: number;
    tokens: number;
    skillFrontmatter: { name: string; source: string; tokens: number }[];
  };
  isAutoCompactEnabled?: boolean;
  autoCompactThreshold?: number;
}

interface ContextUsageDialogProps {
  isOpen: boolean;
  data: ContextUsageData | null;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  systemPrompt: "系统 Prompt",
  memoryFiles: "Memory 文件",
  mcpTools: "MCP 工具",
  agents: "子 Agent",
  skills: "Skills",
  toolDefinitions: "工具定义",
  conversation: "对话历史",
  free: "可用空间",
};

function categoryLabel(name: string): string {
  return CATEGORY_LABELS[name] ?? name;
}

export function ContextUsageDialog({ isOpen, data, onClose }: ContextUsageDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const pct = data?.percentage ?? 0;
  const danger = pct > 90;
  const warn = pct > 70 && !danger;

  return (
    <div className="cc-perm-overlay" onClick={onClose}>
      <div className="cc-ctx-dialog" onClick={e => e.stopPropagation()}>
        <div className="cc-perm-title">
          <span>📊 上下文用量</span>
          <button className="cc-ctx-close" onClick={onClose}>×</button>
        </div>

        {!data ? (
          <div className="cc-ctx-loading">加载中...</div>
        ) : (
          <>
            <div className="cc-ctx-model">
              模型: <code>{data.model}</code>
              {data.isAutoCompactEnabled && (
                <span className="cc-ctx-autocompact">自动压缩 @ {data.autoCompactThreshold ?? 80}%</span>
              )}
            </div>

            {/* 总览进度条 */}
            <div className="cc-ctx-total">
              <div className="cc-ctx-total-info">
                <span>{formatTokens(data.totalTokens)} / {formatTokens(data.maxTokens)} tokens</span>
                <span className={`cc-ctx-pct ${danger ? "cc-ctx-pct-danger" : warn ? "cc-ctx-pct-warn" : ""}`}>{pct.toFixed(1)}%</span>
              </div>
              <div className="cc-ctx-bar">
                <div
                  className={`cc-ctx-bar-fill ${danger ? "danger" : warn ? "warn" : ""}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>

            {/* 分类占比堆叠条 */}
            {data.categories.length > 0 && (
              <div className="cc-ctx-section">
                <div className="cc-ctx-section-title">分类占比</div>
                <div className="cc-ctx-stacked">
                  {data.categories.map((c, i) => {
                    const w = data.maxTokens > 0 ? (c.tokens / data.maxTokens) * 100 : 0;
                    if (w < 0.1) return null;
                    return (
                      <div
                        key={i}
                        className="cc-ctx-stacked-seg"
                        style={{ width: `${w}%`, background: c.color }}
                        title={`${categoryLabel(c.name)}: ${formatTokens(c.tokens)} tokens${c.isDeferred ? " (延迟加载)" : ""}`}
                      />
                    );
                  })}
                </div>
                <div className="cc-ctx-legend">
                  {data.categories.map((c, i) => (
                    <div key={i} className="cc-ctx-legend-item">
                      <span className="cc-ctx-legend-dot" style={{ background: c.color }} />
                      <span className="cc-ctx-legend-name">{categoryLabel(c.name)}{c.isDeferred ? " *" : ""}</span>
                      <span className="cc-ctx-legend-tokens">{formatTokens(c.tokens)}</span>
                    </div>
                  ))}
                </div>
                <div className="cc-ctx-hint">* 延迟加载（首次使用时才计入）</div>
              </div>
            )}

            {/* Memory 文件 */}
            {data.memoryFiles && data.memoryFiles.length > 0 && (
              <div className="cc-ctx-section">
                <div className="cc-ctx-section-title">Memory 文件 ({data.memoryFiles.length})</div>
                {data.memoryFiles.map((f, i) => (
                  <div key={i} className="cc-ctx-item">
                    <span className="cc-ctx-item-path">{f.path}</span>
                    <span className="cc-ctx-item-type">{f.type}</span>
                    <span className="cc-ctx-item-tokens">{formatTokens(f.tokens)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* MCP 工具 */}
            {data.mcpTools && data.mcpTools.length > 0 && (
              <div className="cc-ctx-section">
                <div className="cc-ctx-section-title">MCP 工具 ({data.mcpTools.length})</div>
                {data.mcpTools.map((t, i) => (
                  <div key={i} className="cc-ctx-item">
                    <span className="cc-ctx-item-path">{t.name}</span>
                    <span className="cc-ctx-item-type">{t.serverName}</span>
                    <span className="cc-ctx-item-tokens">{formatTokens(t.tokens)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 子 Agent */}
            {data.agents && data.agents.length > 0 && (
              <div className="cc-ctx-section">
                <div className="cc-ctx-section-title">子 Agent ({data.agents.length})</div>
                {data.agents.map((a, i) => (
                  <div key={i} className="cc-ctx-item">
                    <span className="cc-ctx-item-path">{a.agentType}</span>
                    <span className="cc-ctx-item-type">{a.source}</span>
                    <span className="cc-ctx-item-tokens">{formatTokens(a.tokens)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Skills */}
            {data.skills && data.skills.totalSkills > 0 && (
              <div className="cc-ctx-section">
                <div className="cc-ctx-section-title">
                  Skills ({data.skills.includedSkills}/{data.skills.totalSkills} 已加载 · {formatTokens(data.skills.tokens)})
                </div>
                {data.skills.skillFrontmatter.map((s, i) => (
                  <div key={i} className="cc-ctx-item">
                    <span className="cc-ctx-item-path">{s.name}</span>
                    <span className="cc-ctx-item-type">{s.source}</span>
                    <span className="cc-ctx-item-tokens">{formatTokens(s.tokens)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
