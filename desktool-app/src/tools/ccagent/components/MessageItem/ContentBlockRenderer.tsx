// ContentBlockRenderer — 按 Claude content block 类型分发渲染
// 对齐 cc-gui 的 ContentBlockRenderer，支持 text/thinking/tool_use/image/attachment

import { type ReactNode } from "react";
import type { ToolUseBlock } from "../../types";
import { ToolBlockDispatcher } from "../toolBlocks";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "attachment"; filePath: string; preview?: string };

export interface ContentBlockRendererProps {
  blocks: ContentBlock[];
  /** 工具结果，key 为 tool_use id */
  toolResults?: Record<string, { result?: string; isError?: boolean }>;
  /** 流式中的 tool_use（pending） */
  pendingToolIds?: Set<string>;
  /** thinking 默认折叠 */
  defaultThinkingCollapsed?: boolean;
  /** 搜索高亮 query */
  searchQuery?: string;
}

export function ContentBlockRenderer(props: ContentBlockRendererProps): ReactNode {
  const { blocks, toolResults = {}, pendingToolIds = new Set(), searchQuery } = props;

  return (
    <div className="cc-content-blocks">
      {blocks.map((b, i) => {
        if (b.type === "text") {
          return <TextBlock key={i} text={b.text} searchQuery={searchQuery} />;
        }
        if (b.type === "thinking") {
          return <ThinkingBlock key={i} text={b.text} />;
        }
        if (b.type === "tool_use") {
          const result = toolResults[b.id];
          const tool: ToolUseBlock = {
            id: b.id,
            name: b.name,
            input: b.input,
            result: result?.result,
            isPending: pendingToolIds.has(b.id),
            isError: result?.isError,
          };
          return <ToolBlockDispatcher key={i} tool={tool} />;
        }
        if (b.type === "image") {
          return (
            <img
              key={i}
              className="cc-content-image"
              src={`data:${b.source.media_type};base64,${b.source.data}`}
              alt="attachment"
            />
          );
        }
        if (b.type === "attachment") {
          return (
            <div key={i} className="cc-content-attachment">
              📎 {b.filePath}
              {b.preview && <pre className="cc-content-attachment-preview">{b.preview}</pre>}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

// ── TextBlock ──
function TextBlock({ text, searchQuery }: { text: string; searchQuery?: string }) {
  // 这里仅做最简单的渲染；markdown 处理由 MessageItem 的 MarkdownContent 完成
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.trim();
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return (
      <div className="cc-content-text">
        {parts.map((p, i) =>
          p.toLowerCase() === q.toLowerCase()
            ? <mark key={i} className="cc-search-highlight">{p}</mark>
            : <span key={i}>{p}</span>
        )}
      </div>
    );
  }
  return <div className="cc-content-text">{text}</div>;
}

// ── ThinkingBlock ──
function ThinkingBlock({ text }: { text: string }) {
  // 使用 details/summary 原生折叠
  return (
    <details className="cc-thinking-block">
      <summary>💭 思考过程</summary>
      <pre className="cc-thinking-text">{text}</pre>
    </details>
  );
}
