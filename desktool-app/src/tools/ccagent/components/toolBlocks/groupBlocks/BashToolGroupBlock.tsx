// BashToolGroupBlock — 连续 Bash 调用合并展示
// D6增强: 退出码解析 + 耗时显示 + 一键复制

import { useState } from "react";
import type { ToolGroupBlockProps } from "./shared";
import { getInputString, truncate } from "../shared";

/** 尝试从结果文本中提取退出码 */
function extractExitCode(result?: string): number | null {
  if (!result) return null;
  // 匹配 "exit code: 1" 或 "Exit code: 0"
  const m = result.match(/exit\s*code:\s*(\d+)/i);
  if (m) return parseInt(m[1], 10);
  // 匹配行首的 "[Exit 1]"
  const m2 = result.match(/\[exit\s+(\d+)\]/i);
  return m2 ? parseInt(m2[1], 10) : null;
}

/** 复制到剪贴板 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

/** 格式化 bash 命令（截断为一行） */
function formatBashCommand(cmd: string): string {
  return cmd.replace(/\s+/g, " ").trim();
}

export function BashToolGroupBlock({ items }: ToolGroupBlockProps) {
  const [expandedIdx, setExpandedIdx] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const totalCommands = items.length;
  const errorCount = items.filter(i => i.tool.isError).length;
  const pendingCount = items.filter(i => i.tool.isPending).length;
  const successCount = totalCommands - errorCount - pendingCount;

  async function handleCopy(id: string, text: string) {
    if (await copyText(text)) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  if (collapsed) {
    return (
      <div className="cc-tb-group cc-tb-group-bash" onClick={() => setCollapsed(false)}>
        <div className="cc-tb-group-header">
          <span className="cc-tb-group-icon">⚡</span>
          <span className="cc-tb-group-name">Bash × {totalCommands}</span>
          {successCount > 0 && <span className="cc-tb-group-ok">✓ {successCount}</span>}
          {errorCount > 0 && <span className="cc-tb-group-error">✗ {errorCount}</span>}
          {pendingCount > 0 && <span className="cc-tb-group-pending">⏳ {pendingCount}</span>}
          <span className="cc-tb-group-toggle">展开 ▸</span>
        </div>
      </div>
    );
  }

  return (
    <div className="cc-tb-group cc-tb-group-bash">
      <div className="cc-tb-group-header" onClick={() => setCollapsed(true)}>
        <span className="cc-tb-group-icon">⚡</span>
        <span className="cc-tb-group-name">Bash × {totalCommands}</span>
        {successCount > 0 && <span className="cc-tb-group-ok">✓ {successCount}</span>}
        {errorCount > 0 && <span className="cc-tb-group-error">✗ {errorCount}</span>}
        {pendingCount > 0 && <span className="cc-tb-group-pending">⏳ {pendingCount}</span>}
        <span className="cc-tb-group-toggle">收起 ▴</span>
      </div>

      <div className="cc-tb-group-list">
        {items.map(({ tool }) => {
          const cmd = formatBashCommand(getInputString(tool.input, "command"));
          const isExpanded = expandedIdx === tool.id;
          const exitCode = extractExitCode(tool.result);
          const hasErr = tool.isError || (exitCode !== null && exitCode !== 0);

          return (
            <div key={tool.id}
              className={`cc-tb-group-item ${hasErr ? "error" : ""} ${tool.isPending ? "pending" : ""}`}>
              <div className="cc-tb-group-item-head" onClick={() => setExpandedIdx(isExpanded ? null : tool.id)}>
                <span className="cc-tb-group-item-icon">
                  {tool.isPending ? "⏳" : hasErr ? "❌" : "✓"}
                </span>
                <code className="cc-tb-group-item-cmd">{truncate(cmd, 80)}</code>
                {exitCode !== null && (
                  <span className={`cc-tb-group-exit ${exitCode === 0 ? "ok" : "err"}`}>
                    exit {exitCode}
                  </span>
                )}
                <span className="cc-tb-group-item-actions">
                  <button
                    className="cc-tb-group-copy"
                    onClick={e => { e.stopPropagation(); handleCopy(tool.id, cmd); }}
                    title="复制命令"
                  >
                    {copiedId === tool.id ? "✓" : "📋"}
                  </button>
                </span>
                <span className="cc-tb-group-item-chevron">{isExpanded ? "▼" : "▶"}</span>
              </div>

              {isExpanded && tool.result && (
                <pre className="cc-tb-group-item-result">
                  <div className="cc-tb-group-result-meta">
                    {exitCode !== null && (
                      <span className={`cc-tb-group-exit ${exitCode === 0 ? "ok" : "err"}`}>
                        退出码: {exitCode}
                      </span>
                    )}
                    <button
                      className="cc-tb-group-copy"
                      onClick={() => handleCopy(tool.id + "-out", tool.result!)}
                      title="复制输出"
                    >
                      {copiedId === tool.id + "-out" ? "✓ 已复制" : "复制输出"}
                    </button>
                  </div>
                  {truncate(tool.result, 2000)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
