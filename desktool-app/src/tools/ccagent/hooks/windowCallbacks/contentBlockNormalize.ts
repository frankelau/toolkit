// contentBlockNormalize.ts — 内容块标准化处理
// 对齐 cc-gui hooks/windowCallbacks/contentBlockNormalize.ts
// 合并/去重/排序流式工具调用块

import type { ToolUseBlock } from "../../types";

/** 合并一组工具调用块（去重 + 按 id 稳定排序） */
export function normalizeToolBlocks(blocks: ToolUseBlock[]): ToolUseBlock[] {
  if (blocks.length === 0) return [];

  // 去重：同一个 id 只保留最后一个（流式可能会多次更新同一块）
  const seen = new Map<string, number>();
  const deduped: ToolUseBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const prev = seen.get(blocks[i].id);
    if (prev !== undefined) {
      // 更新已有块
      deduped[prev] = blocks[i];
    } else {
      seen.set(blocks[i].id, deduped.length);
      deduped.push(blocks[i]);
    }
  }

  // 排序：pending 在最后，错误在 pending 前
  return [...deduped].sort((a, b) => {
    if (a.isPending && !b.isPending) return 1;
    if (!a.isPending && b.isPending) return -1;
    if (a.isError && !b.isError) return 1;
    if (!a.isError && b.isError) return -1;
    return 0;
  });
}

/** 合并两组工具调用块（新块优先） */
export function mergeToolBlocks(existing: ToolUseBlock[], incoming: ToolUseBlock[]): ToolUseBlock[] {
  if (incoming.length === 0) return existing;
  if (existing.length === 0) return incoming;

  const merged = new Map<string, ToolUseBlock>();
  for (const b of existing) merged.set(b.id, b);
  for (const b of incoming) merged.set(b.id, b);
  return normalizeToolBlocks(Array.from(merged.values()));
}

/** 从流式内容中提取工具调用块（用于流式结束后的最终处理） */
export interface ParsedContent {
  text: string;
  toolBlocks: ToolUseBlock[];
}

export function parseStreamingContent(
  content: string,
  existingBlocks: ToolUseBlock[] = [],
): ParsedContent {
  // 不完整的工具调用标签检测
  const openTags = (content.match(/<tool_use>/g) || []).length;
  const closeTags = (content.match(/<\/tool_use>/g) || []).length;

  // 如果工具调用标签不配对，内容仍在流式中
  if (openTags !== closeTags) {
    return { text: content, toolBlocks: normalizeToolBlocks(existingBlocks) };
  }

  return { text: content, toolBlocks: normalizeToolBlocks(existingBlocks) };
}

/** 清理流式内容末尾的噪声（不完整标签/重复句尾等） */
export function cleanStreamEnd(content: string): string {
  if (!content) return "";

  let cleaned = content;

  // 移除末尾不完整的 XML 标签
  cleaned = cleaned.replace(/(?:<\/(?:\w|-)*|<\/?(?:\w|-)*(?:\s+[^>]*)?)$/, "");

  // 移除末尾不完整的 markdown 代码块
  cleaned = cleaned.replace(/```\w*$/, "");

  // 移除重复的句尾（流式偶尔会重复最后一个字符）
  const lastChar = cleaned.slice(-1);
  if (lastChar && cleaned.endsWith(lastChar.repeat(3)) && lastChar !== "\n") {
    cleaned = cleaned.replace(new RegExp(lastChar + "+$"), lastChar);
  }

  return cleaned.trimEnd();
}

/** 检测内容块是否为纯系统信息（应过滤） */
export function isSystemContent(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim().toLowerCase();
  return (
    trimmed.startsWith("<system") ||
    trimmed.startsWith("[system") ||
    trimmed === "..." ||
    trimmed === "…" ||
    /^\[\d+:\d+:\d+(\.\d+)?\]\s*$/.test(trimmed)
  );
}
