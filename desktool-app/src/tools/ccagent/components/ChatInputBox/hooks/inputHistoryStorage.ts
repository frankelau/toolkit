// inputHistoryStorage — 输入历史持久化（对齐 cc-gui inputHistoryStorage）
// Sprint B: localStorage 存储 + 使用计数 + 时间戳

export const HISTORY_STORAGE_KEY = "ccagent:inputHistory";
export const HISTORY_COUNTS_KEY = "ccagent:inputHistoryCounts";
export const HISTORY_TIMESTAMPS_KEY = "ccagent:inputHistoryTs";
export const HISTORY_ENABLED_KEY = "ccagent:inputHistoryEnabled";
export const MAX_HISTORY_ITEMS = 200;

const INVISIBLE_CHARS_RE = /[\u200B-\u200D\uFEFF]/g;

export interface HistoryItem {
  text: string;
  count: number;
  lastUsed: number;
}

export function canUseLocalStorage(): boolean {
  try { return typeof window !== "undefined" && !!window.localStorage; }
  catch { return false; }
}

export function isHistoryCompletionEnabled(): boolean {
  if (!canUseLocalStorage()) return true;
  return localStorage.getItem(HISTORY_ENABLED_KEY) !== "false";
}

export function loadHistory(): string[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(s => typeof s === "string") : [];
  } catch { return []; }
}

export function saveHistory(items: string[]): string[] {
  if (!canUseLocalStorage()) return items;
  try {
    const capped = items.slice(-MAX_HISTORY_ITEMS);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(capped));
    return capped;
  } catch { return items; }
}

export function loadCounts(): Record<string, number> {
  if (!canUseLocalStorage()) return {};
  try {
    const raw = localStorage.getItem(HISTORY_COUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveTimestamps(fragments: string[]): void {
  if (!canUseLocalStorage()) return;
  try {
    const raw = localStorage.getItem(HISTORY_TIMESTAMPS_KEY);
    const ts = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    for (const f of fragments) ts[f] = now;
    localStorage.setItem(HISTORY_TIMESTAMPS_KEY, JSON.stringify(ts));
  } catch { /* ignore */ }
}

export function cleanupCounts(counts: Record<string, number>): Record<string, number> {
  const entries = Object.entries(counts);
  if (entries.length <= MAX_HISTORY_ITEMS * 2) return counts;
  // 保留 count 最高的
  entries.sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(entries.slice(0, MAX_HISTORY_ITEMS));
}

export function deleteHistoryItem(text: string): void {
  const items = loadHistory().filter(i => i !== text);
  saveHistory(items);
}

export function clearAllHistory(): void {
  if (!canUseLocalStorage()) return;
  localStorage.removeItem(HISTORY_STORAGE_KEY);
  localStorage.removeItem(HISTORY_COUNTS_KEY);
  localStorage.removeItem(HISTORY_TIMESTAMPS_KEY);
}

/** 按重要性排序的历史（count 高的优先） */
export function loadHistoryWithImportance(limit = 50): HistoryItem[] {
  const items = loadHistory();
  const counts = loadCounts();
  return items
    .map(text => ({ text, count: counts[text] || 1, lastUsed: 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function addHistoryItem(text: string): void {
  const sanitized = text.replace(INVISIBLE_CHARS_RE, "").trim();
  if (!sanitized) return;
  const items = loadHistory().filter(i => i !== sanitized);
  items.push(sanitized);
  saveHistory(items);
}

export { INVISIBLE_CHARS_RE };

/** 简化版 splitTextToFragments：长文本不拆分 */
export function splitTextToFragments(text: string): string[] {
  if (!text.trim()) return [];
  if (text.length > 500) return [text.trim()];
  return [text.trim()];
}
