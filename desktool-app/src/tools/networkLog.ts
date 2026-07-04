/**
 * 内存网络日志 store —— 不持久化，页面重载后清空。
 * 各网络工具通过 addEntry / updateEntry 写入，
 * NetworkPanel 通过 useNetworkLog 订阅渲染。
 */
import { useEffect, useState } from "react";

export type NetState = "pending" | "streaming" | "done" | "error";
export type NetType = "http" | "ws" | "sse";

export interface NetEntry {
  id: string;
  tool: string;
  type: NetType;
  method?: string;
  url: string;
  reqHeaders?: Record<string, string>;
  reqBody?: string;
  status?: number;
  statusText?: string;
  resHeaders?: [string, string][];
  resBody?: string;
  duration?: number;
  error?: string;
  state: NetState;
  startTime: number;
}

const entries: NetEntry[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function addEntry(e: Omit<NetEntry, "id" | "startTime">): string {
  const id = Math.random().toString(36).slice(2, 10);
  entries.unshift({ ...e, id, startTime: Date.now() });
  if (entries.length > 300) entries.length = 300;
  notify();
  return id;
}

export function updateEntry(id: string, patch: Partial<NetEntry>) {
  const i = entries.findIndex((e) => e.id === id);
  if (i >= 0) { Object.assign(entries[i], patch); notify(); }
}

export function clearLog() {
  entries.length = 0;
  notify();
}

/** React hook：订阅日志更新，返回当前快照 */
export function useNetworkLog(tool?: string): NetEntry[] {
  const [, tick] = useState(0);
  useEffect(() => {
    const cb = () => tick((t) => t + 1);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);
  const snap = [...entries];
  return tool ? snap.filter((e) => e.tool === tool) : snap;
}

const PERSIST_KEY_PREFIX = "np:log:";
const PERSIST_MAX = 100;

export function loadPersistedLog(tool: string): NetEntry[] {
  try {
    const raw = localStorage.getItem(PERSIST_KEY_PREFIX + tool);
    if (!raw) return [];
    return JSON.parse(raw) as NetEntry[];
  } catch {
    return [];
  }
}

export function savePersistedLog(tool: string, entries: NetEntry[]): void {
  const toSave = entries.length > PERSIST_MAX ? entries.slice(0, PERSIST_MAX) : entries;
  try {
    localStorage.setItem(PERSIST_KEY_PREFIX + tool, JSON.stringify(toSave));
  } catch { }
}
