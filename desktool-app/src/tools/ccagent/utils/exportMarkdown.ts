// exportMarkdown.ts — 导出对话为 Markdown (增强版 D4)
// 新增: 消息元数据 + token 统计 + 代码块格式 + 时间戳

import type { ChatMessage } from "../types";
import { summarizeToolInput } from "./toolUtils";

/** 格式化耗时 */
function fmtDuration(ms?: number): string {
  if (!ms) return "";
  const s = Math.floor(ms / 1000);
  if (s >= 3600) return `${Math.floor(s/3600)}h${Math.floor((s%3600)/60)}m${s%60}s`;
  if (s >= 60) return `${Math.floor(s/60)}m${s%60}s`;
  return `${s}s`;
}

/** 格式化 token 数 */
function fmtTokens(n?: number): string {
  if (!n) return "";
  if (n >= 1000) return `${(n/1000).toFixed(1)}K`;
  return String(n);
}

export function exportMessagesToMarkdown(messages: ChatMessage[]): string {
  const parts: string[] = [];

  // 标题 + 元数据
  parts.push(`# 对话导出`);
  parts.push(`> 导出时间: ${new Date().toLocaleString()}`);
  parts.push(`> 消息数: ${messages.length}`);

  // 总体统计
  let totalInput = 0, totalOutput = 0, totalCost = 0;
  for (const m of messages) {
    if (m.usage) {
      if (m.usage.inputTokens) totalInput += m.usage.inputTokens;
      if (m.usage.outputTokens) totalOutput += m.usage.outputTokens;
      if (m.usage.costUsd) totalCost += m.usage.costUsd;
    }
  }
  if (totalInput > 0 || totalOutput > 0) {
    parts.push(`> Tokens: 📥 ${fmtTokens(totalInput)} / 📤 ${fmtTokens(totalOutput)}${totalCost > 0 ? ` · 💰 $${totalCost.toFixed(4)}` : ""}`);
  }
  parts.push("");

  let msgIdx = 0;
  for (const m of messages) {
    msgIdx++;
    const roleEmoji = m.role === "user" ? "👤" : m.role === "assistant" ? "🤖" : "⚙️";
    const roleName = m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : "System";
    const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : "";

    parts.push(`---`);
    parts.push(`### ${roleEmoji} ${roleName} ${timeStr ? `(${timeStr})` : ""}`);

    // 元数据
    const meta: string[] = [];
    if (m.usage?.durationMs) meta.push(`⏱ ${fmtDuration(m.usage.durationMs)}`);
    if (m.usage?.inputTokens) meta.push(`📥 ${fmtTokens(m.usage.inputTokens)}`);
    if (m.usage?.outputTokens) meta.push(`📤 ${fmtTokens(m.usage.outputTokens)}`);
    if (m.usage?.cacheReadTokens) meta.push(`💾 ${fmtTokens(m.usage.cacheReadTokens)}`);
    if (m.usage?.costUsd) meta.push(`💰 $${m.usage.costUsd!.toFixed(6)}`);
    if (meta.length > 0) parts.push(`> ${meta.join(" · ")}`);
    parts.push("");

    // Thinking
    if (m.thinking) {
      parts.push(`<details>`);
      parts.push(`<summary>💭 思考过程</summary>`);
      parts.push("");
      parts.push(m.thinking);
      parts.push("");
      parts.push(`</details>`);
      parts.push("");
    }

    // Content
    if (m.content) {
      parts.push(m.content);
      parts.push("");
    }

    // Tool uses
    if (m.toolUses?.length) {
      parts.push(`**工具调用 (${m.toolUses.length}):**`);
      parts.push("");
      for (const t of m.toolUses) {
        parts.push(`- \`${t.name}\`: ${summarizeToolInput(t.name, t.input)}`);
        if (t.result) {
          const truncated = t.result.length > 300 ? t.result.slice(0, 300) + "…" : t.result;
          parts.push(`  \`\`\``);
          parts.push(`  ${truncated}`);
          parts.push(`  \`\`\``);
        }
      }
      parts.push("");
    }

    // Attachments
    if (m.attachments?.length) {
      parts.push(`📎 附件: ${m.attachments.map(a => a.name).join(", ")}`);
      parts.push("");
    }
  }

  return parts.join("\n");
}

/** 导出为纯文本（无 markdown 格式） */
export function exportMessagesToText(messages: ChatMessage[]): string {
  return messages.map(m => {
    const role = m.role === "user" ? "[User]" : m.role === "assistant" ? "[Assistant]" : "[System]";
    const body = m.content || (m.thinking ? `[Thinking: ${m.thinking.slice(0, 100)}…]` : "[无内容]");
    return `${role} ${body}`;
  }).join("\n\n");
}

/** 导出为 JSON */
export function exportMessagesToJson(messages: ChatMessage[]): string {
  return JSON.stringify(messages.map(m => ({
    role: m.role,
    content: m.content,
    thinking: m.thinking,
    timestamp: m.timestamp,
    usage: m.usage,
    toolUses: m.toolUses?.map(t => ({ name: t.name, input: t.input, result: t.result })),
  })), null, 2);
}
