// 消息渲染组件 — 深度增强版
// v2: + formatDurationMs / groupBlocks / 增强 UsageBadge（缓存命中）/ CopyButton memo
// 对齐 cc-gui MessageItem 核心功能

import { useState, useMemo, memo, useCallback } from "react";
import type { ChatMessage, DiffResult, ToolUseBlock } from "../../types";
import { formatCost, highlightText } from "../../utils";
import { ToolBlockDispatcher } from "../toolBlocks";
import MarkdownBlock from "../MarkdownBlock";

// ── 工具函数 ─────────────────────────────────────────────────────────────────

/** 智能耗时格式化（对齐 cc-gui formatDurationMs） */
function formatDurationMs(durationMs: number): string {
  const seconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  if (secs >= 10) return `${secs}s`;
  return `${seconds}.${Math.floor((durationMs % 1000) / 100)}s`;
}

/** 格式化 token 计数（K/M 缩写） */
function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

// ── Diff Viewer ────────────────────────────────────────────────────────────

export function DiffViewer({ diff }: { diff: DiffResult }) {
  return (
    <div className="cc-diff">
      <div className="cc-diff-header">
        📝 {diff.filePath}
        {diff.oldContent === null && <span className="cc-diff-badge cc-diff-new">新建</span>}
      </div>
      <div className="cc-diff-body">
        {diff.hunks.map((h, i) => (
          <div key={i} className={`cc-diff-line cc-diff-${h.type}`}>
            <span className="cc-diff-gutter">{h.type === "add" ? "+" : h.type === "del" ? "-" : " "}</span>
            <span className="cc-diff-text">{h.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tool Use View ───────────────────────────────────────────────────────────

export function ToolUseView({ tool }: { tool: ToolUseBlock }) {
  return <ToolBlockDispatcher tool={tool} />;
}

// ── 消息分组（合并连续同类型 tool block） ─────────────────────────────────────

export interface GroupedBlock {
  type: "text" | "thinking" | "toolUses";
  toolUses?: ToolUseBlock[];
  content?: string;
}

export function groupBlocks(msg: ChatMessage): GroupedBlock[] {
  const blocks: GroupedBlock[] = [];

  if (msg.thinking) {
    blocks.push({ type: "thinking", content: msg.thinking });
  }

  if (msg.toolUses && msg.toolUses.length > 0) {
    blocks.push({ type: "toolUses", toolUses: msg.toolUses });
  }

  if (msg.content) {
    blocks.push({ type: "text", content: msg.content });
  }

  return blocks;
}

// ── Thinking Block ─────────────────────────────────────────────────────────

export function ThinkingBlock({ thinking, defaultOpen }: { thinking: string; defaultOpen?: boolean }) {
  const [show, setShow] = useState(defaultOpen ?? false);
  return (
    <details className="cc-thinking" open={show}>
      <summary onClick={e => { e.preventDefault(); setShow(!show); }}>
        💭 思考过程 {show ? "▼" : "▶"}
      </summary>
      <div className="cc-thinking-body">{thinking}</div>
    </details>
  );
}

// ── Copy Button (memo) ──────────────────────────────────────────────────────

const CopyIcon = memo(() => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M4 4v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z" fill="currentColor" fillOpacity="0.9"/>
    <path d="M2 2v8H0V2a2 2 0 0 1 2-2h8v2H2z" fill="currentColor" fillOpacity="0.6"/>
  </svg>
));

export { CopyButton };

const CopyButton = memo(function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;left:-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [text]);

  return (
    <button className="cc-copy-btn-inline" onClick={handleCopy} title={label || "复制"}>
      {copied ? "✓ 已复制" : <><CopyIcon /> {label || "复制"}</>}
    </button>
  );
});

// ── Usage Badge（增强：缓存命中分解） ─────────────────────────────────────────

export function UsageBadge({ usage, isStreaming }: {
  usage: NonNullable<ChatMessage["usage"]>;
  isStreaming?: boolean;
}) {
  if (isStreaming) return null;

  return (
    <div className="cc-msg-usage">
      {usage.durationMs != null && usage.durationMs > 0 && (
        <span className="cc-usage-duration" title={`${usage.durationMs}ms`}>
          ⏱ {formatDurationMs(usage.durationMs)}
        </span>
      )}
      {usage.inputTokens != null && usage.inputTokens > 0 && (
        <span title={`输入: ${usage.inputTokens.toLocaleString()} tokens`}>
          📥 {formatTokenCount(usage.inputTokens)}
        </span>
      )}
      {usage.cacheReadTokens != null && usage.cacheReadTokens > 0 && (
        <span className="cc-usage-cache" title={`缓存读取: ${usage.cacheReadTokens.toLocaleString()} tokens`}>
          💾 {formatTokenCount(usage.cacheReadTokens)}
        </span>
      )}
      {usage.cacheCreateTokens != null && usage.cacheCreateTokens > 0 && (
        <span className="cc-usage-cache-create" title={`缓存写入: ${usage.cacheCreateTokens.toLocaleString()} tokens`}>
          📝 {formatTokenCount(usage.cacheCreateTokens)}
        </span>
      )}
      {usage.outputTokens != null && usage.outputTokens > 0 && (
        <span title={`输出: ${usage.outputTokens.toLocaleString()} tokens`}>
          📤 {formatTokenCount(usage.outputTokens)}
        </span>
      )}
      {usage.costUsd != null && usage.costUsd > 0 && (
        <span title={`费用: $${usage.costUsd.toFixed(6)}`}>
          💰 {formatCost(usage.costUsd)}
        </span>
      )}
    </div>
  );
}

// ── Message Actions ────────────────────────────────────────────────────────

export function MessageActions({ content, canRewind, onRewind }: {
  content: string;
  canRewind: boolean;
  onRewind: (steps: number) => void;
}) {
  return (
    <div className="cc-msg-actions">
      <CopyButton text={content} />
      {canRewind && <button className="cc-msg-rewind-btn" onClick={() => onRewind(2)}>⏪ 回退</button>}
    </div>
  );
}

// ── Message Row（增强：分组显示 + 流式状态指示） ──────────────────────────────

export const MessageRow = memo(function MessageRow({
  msg, onRewind, canRewind, searchQuery = "",
}: {
  msg: ChatMessage;
  onRewind: (steps: number) => void;
  canRewind: boolean;
  searchQuery?: string;
}) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";

  if (isSystem) return <div className="cc-msg-system">{msg.content}</div>;

  const blocks = useMemo(() => groupBlocks(msg), [msg.thinking, msg.toolUses, msg.content]);

  return (
    <div className={`cc-msg ${isUser ? "cc-msg-user" : "cc-msg-assistant"}`}>
      <div className="cc-msg-avatar">{isUser ? "👤" : "🤖"}</div>
      <div className="cc-msg-body">
        {/* Attachments */}
        {msg.attachments?.map((a, i) => (
          <img key={i} src={`data:${a.mimeType};base64,${a.data}`} className="cc-msg-attachment" alt={a.name} />
        ))}

        {/* Grouped blocks */}
        {blocks.map((block) => {
          if (block.type === "thinking") {
            return <ThinkingBlock key="thinking" thinking={block.content!} defaultOpen={!msg.content} />;
          }
          if (block.type === "toolUses") {
            return (
              <div key="tools" className="cc-tool-blocks">
                {block.toolUses!.map((tu) => <ToolUseView key={tu.id} tool={tu} />)}
              </div>
            );
          }
          if (block.type === "text") {
            return isUser ? (
              <div key="text" className="cc-msg-text cc-msg-text-user">
                {searchQuery ? highlightText(block.content!, searchQuery) : block.content}
              </div>
            ) : (
              <MarkdownBlock key="text" content={block.content!} isStreaming={msg.isStreaming} enableCopy />
            );
          }
          return null;
        })}

        {/* 流式指示器 */}
        {msg.isStreaming && !msg.content && !msg.thinking && (
          <div className="cc-typing"><span /><span /><span /></div>
        )}

        {/* Usage */}
        {msg.usage && <UsageBadge usage={msg.usage} isStreaming={msg.isStreaming} />}

        {/* Actions */}
        {!isUser && !msg.isStreaming && msg.content && (
          <MessageActions content={msg.content} canRewind={canRewind} onRewind={onRewind} />
        )}
      </div>
    </div>
  );
});
