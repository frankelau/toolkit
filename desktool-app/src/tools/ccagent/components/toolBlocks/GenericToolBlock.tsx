// 通用工具块 — 多类型参数渲染 + 一键复制
// D6增强: 数组/对象/字符串/文件参数 差异化渲染

import { useState } from "react";
import { copyText } from "../../../../useCopyFeedback";
import type { ToolBlockProps } from "./shared";
import { ToolStatusIcon, TOOL_ICONS, truncate } from "./shared";

/** 根据参数值类型选择合适的渲染方式 */
function renderParamValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "string") return val.length > 200 ? val.slice(0, 200) + "…" : val;
  if (Array.isArray(val)) {
    if (val.length === 0) return "[]";
    const items = val.slice(0, 5).map(v => typeof v === "string" ? `"${v}"` : String(v));
    return `[${items.join(", ")}${val.length > 5 ? `, …+${val.length - 5}` : ""}]`;
  }
  if (typeof val === "object") {
    const keys = Object.keys(val as Record<string, unknown>);
    if (keys.length === 0) return "{}";
    const preview = keys.slice(0, 3).join(", ");
    return `{${preview}${keys.length > 3 ? `, …+${keys.length - 3}` : ""}}`;
  }
  return String(val).slice(0, 200);
}

/** 提取有意义的参数（跳过大型内容字段） */
function getMeaningfulParams(input: Record<string, unknown>): [string, string][] {
  const skipKeys = new Set(["content", "new_string", "old_string", "edits", "prompt",
    "text", "message", "description", "instructions"]);
  const entries: [string, string][] = [];
  for (const [k, v] of Object.entries(input)) {
    if (skipKeys.has(k)) continue;
    entries.push([k, renderParamValue(v)]);
  }
  return entries.slice(0, 4); // 最多4个参数
}

export function GenericToolBlock({ tool }: ToolBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [resultCopied, setResultCopied] = useState(false);
  const icon = TOOL_ICONS[tool.name] ?? "🔧";

  const params = getMeaningfulParams(tool.input);
  const hasLargeInput = Object.keys(tool.input).some(k =>
    ["content", "new_string", "prompt"].includes(k) &&
    typeof tool.input[k] === "string" && (tool.input[k] as string).length > 100
  );

  async function handleCopy(text: string) {
    copyText(text);
    setResultCopied(true);
    setTimeout(() => setResultCopied(false), 2000);
  }

  return (
    <div className={`cc-tb cc-tb-generic ${tool.isPending ? "cc-tb-pending" : ""} ${tool.isError ? "cc-tb-error" : ""}`}>
      <div className="cc-tb-header" onClick={() => setExpanded(e => !e)}>
        <ToolStatusIcon tool={tool} />
        <span className="cc-tb-icon">{icon}</span>
        <span className="cc-tb-name">{tool.name}</span>
        {params.length > 0 && (
          <span className="cc-tb-desc">{params.map(([, v]) => v).join(" · ")}</span>
        )}
        <span className="cc-tb-expand">{expanded ? "▼" : "▶"}</span>
      </div>

      {expanded && (
        <div className="cc-tb-body">
          {/* 参数列表 */}
          {params.length > 0 && (
            <div className="cc-tb-generic-params">
              {params.map(([key, val]) => (
                <div key={key} className="cc-tb-param">
                  <span className="cc-tb-param-key">{key}</span>
                  <span className="cc-tb-param-val">{val}</span>
                </div>
              ))}
            </div>
          )}

          {/* 大型输入预览 */}
          {hasLargeInput && (
            <details className="cc-tb-details">
              <summary className="cc-tb-detail-label">完整输入</summary>
              <pre className="cc-tb-pre">{JSON.stringify(tool.input, null, 2)}</pre>
            </details>
          )}

          {/* 结果 */}
          {tool.result && (
            <div className="cc-tb-generic-output">
              <div className="cc-tb-output-header">
                <span className="cc-tb-label">{tool.isError ? "错误" : "结果"}</span>
                <button className="cc-tb-copy" onClick={() => handleCopy(tool.result!)}>
                  {resultCopied ? "✓ 已复制" : "📋 复制"}
                </button>
              </div>
              <pre className={tool.isError ? "cc-tb-output-error" : ""}>{truncate(tool.result)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
