// toolUtils.ts — 工具标签和摘要

import { TOOL_LABELS } from "../constants";

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? `🔧 ${name}`;
}

export function summarizeToolInput(name: string, input: Record<string, unknown>): string {
  if (!input) return "";
  if (name === "Bash" && input.command) return String(input.command).slice(0, 80);
  if ((name === "Read" || name === "Write" || name === "Edit") && input.file_path) return String(input.file_path);
  if (name === "WebSearch" && input.query) return String(input.query);
  if (name === "WebFetch" && input.url) return String(input.url);
  if (name === "MultiEdit" && input.file_path) return String(input.file_path);
  const vals = Object.values(input).filter(v => typeof v === "string" || typeof v === "number");
  return vals.slice(0, 2).map(v => String(v).slice(0, 40)).join(" ");
}

/** 从工具 input 提取字符串字段 */
export function getInputString(input: Record<string, unknown>, key: string): string | undefined {
  const v = input[key];
  return typeof v === "string" ? v : (typeof v === "number" ? String(v) : undefined);
}

/** 从工具 input 提取数字字段 */
export function getInputNumber(input: Record<string, unknown>, key: string): number | undefined {
  const v = input[key];
  return typeof v === "number" ? v : (typeof v === "string" ? Number(v) || undefined : undefined);
}

/** 从工具 input 提取数组字段 */
export function getInputArray<T = unknown>(input: Record<string, unknown>, key: string): T[] {
  const v = input[key];
  return Array.isArray(v) ? v as T[] : [];
}

/** 截断文本 */
export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

/** 从路径提取文件名 */
export function getFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}
