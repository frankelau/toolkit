// contentBlockNormalize.ts — 内容块标准化

import type { ToolUseBlock } from "../types";

export interface NormalizedContentBlock {
  type: "text" | "thinking" | "tool_use" | "image" | "tool_result";
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  toolUseId?: string;
  result?: string;
  isError?: boolean;
  source?: { type: "base64"; media_type: string; data: string };
}

/** 把 Claude SDK 原始 content blocks 标准化 */
export function normalizeContentBlocks(
  blocks: Array<Record<string, unknown>>
): NormalizedContentBlock[] {
  return blocks.map(b => {
    const type = b.type as string;
    if (type === "text") {
      return { type: "text", text: b.text as string };
    }
    if (type === "thinking") {
      return { type: "thinking", thinking: b.thinking as string };
    }
    if (type === "tool_use") {
      return {
        type: "tool_use",
        id: b.id as string,
        name: b.name as string,
        input: (b.input ?? {}) as Record<string, unknown>,
      };
    }
    if (type === "tool_result") {
      const content = b.content as string | Array<Record<string, unknown>>;
      const resultText = typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map(c => c.text ?? "").join("")
          : "";
      return {
        type: "tool_result",
        toolUseId: b.tool_use_id as string,
        result: resultText,
        isError: b.is_error === true,
      };
    }
    if (type === "image") {
      return { type: "image", source: b.source as { type: "base64"; media_type: string; data: string } };
    }
    return { type: "text", text: "" };
  });
}

/** 从标准化 blocks 中提取 text */
export function extractText(blocks: NormalizedContentBlock[]): string {
  return blocks
    .filter(b => b.type === "text")
    .map(b => b.text ?? "")
    .join("");
}

/** 从标准化 blocks 中提取 thinking */
export function extractThinking(blocks: NormalizedContentBlock[]): string {
  return blocks
    .filter(b => b.type === "thinking")
    .map(b => b.thinking ?? "")
    .join("");
}

/** 从标准化 blocks 中提取 tool_use */
export function extractToolUses(
  blocks: NormalizedContentBlock[]
): Array<ToolUseBlock & { isPending: boolean }> {
  return blocks
    .filter(b => b.type === "tool_use")
    .map(b => ({
      id: b.id ?? "",
      name: b.name ?? "",
      input: b.input ?? {},
      isPending: true,
    }));
}
