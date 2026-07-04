// MCP 工具函数 — Sprint C

import type { McpServer, McpServerStatus } from "../types";

/** 生成 server id（name 小写 + 随机后缀） */
export function generateServerId(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 获取服务器首字母作为图标 */
export function getServerInitial(server: McpServer): string {
  const name = server.name || server.id;
  return name.charAt(0).toUpperCase();
}

/** 根据 id 生成图标背景色（稳定哈希） */
export function getIconColor(id: string): string {
  const colors = ["#4a9", "#f59e0b", "#6c6", "#e55", "#6cf", "#c6f", "#fc6", "#f6c"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

/** 获取状态图标 */
export function getStatusIcon(status?: McpServerStatus): string {
  switch (status) {
    case "connected": return "🟢";
    case "disconnected": return "⚪";
    case "error": return "🔴";
    case "pending": return "🟡";
    default: return "⚪";
  }
}

/** 获取状态颜色 */
export function getStatusColor(status?: McpServerStatus): string {
  switch (status) {
    case "connected": return "#4a9";
    case "disconnected": return "#888";
    case "error": return "#e55";
    case "pending": return "#f59e0b";
    default: return "#888";
  }
}

/** 获取状态文本 */
export function getStatusText(status?: McpServerStatus): string {
  switch (status) {
    case "connected": return "已连接";
    case "disconnected": return "未连接";
    case "error": return "错误";
    case "pending": return "连接中";
    default: return "未知";
  }
}

/** 判断服务器是否启用 */
export function isServerEnabled(server: McpServer, isCodexMode = false): boolean {
  if (typeof server.enabled === "boolean") return server.enabled;
  if (server.apps) {
    return isCodexMode ? server.apps.codex : server.apps.claude;
  }
  return true;
}

/** 解析 MCP 配置 JSON 字符串 */
export function parseMcpConfig(json: string): Record<string, McpServer> {
  const servers: Record<string, McpServer> = {};
  try {
    const config = JSON.parse(json);
    const mcpServers = config.mcpServers || config.mcpServers || {};
    for (const [id, spec] of Object.entries(mcpServers)) {
      servers[id] = {
        id,
        name: id,
        server: spec as McpServer["server"],
        enabled: true,
      };
    }
  } catch { /* ignore */ }
  return servers;
}

/** 序列化服务器列表为 MCP 配置 JSON */
export function serializeMcpConfig(servers: McpServer[]): string {
  const mcpServers: Record<string, McpServer["server"]> = {};
  for (const s of servers) {
    mcpServers[s.id] = s.server;
  }
  return JSON.stringify({ mcpServers }, null, 2);
}

/** 获取服务器连接类型显示文本 */
export function getConnectionTypeText(server: McpServer): string {
  const type = server.server.type || "stdio";
  switch (type) {
    case "stdio": return `stdio: ${server.server.command || "?"}`;
    case "http": return `http: ${server.server.url || "?"}`;
    case "sse": return `sse: ${server.server.url || "?"}`;
    default: return type;
  }
}

// ── D6增强: 图标颜色 + 工具缓存 (M1+M2) ──────────────────────────────────

/** 服务器图标颜色列表 */
export const SERVER_ICON_COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B",
  "#EF4444", "#06B6D4", "#EC4899", "#6366F1",
];

/** 工具缓存 (LRU + TTL) */
interface CacheEntry<T> { data: T; ts: number; }
const toolCache = new Map<string, CacheEntry<unknown>>();
const MAX_CACHE = 50;
const CACHE_TTL = 10 * 60 * 1000;

export function getCachedTools<T>(serverId: string): T | null {
  const entry = toolCache.get(serverId);
  if (!entry || Date.now() - entry.ts > CACHE_TTL) {
    toolCache.delete(serverId);
    return null;
  }
  return entry.data as T;
}

export function setCachedTools<T>(serverId: string, data: T): void {
  if (toolCache.size >= MAX_CACHE) {
    const first = toolCache.keys().next().value;
    if (first) toolCache.delete(first);
  }
  toolCache.set(serverId, { data, ts: Date.now() });
}

export function clearToolCache(serverId?: string): void {
  if (serverId) toolCache.delete(serverId);
  else toolCache.clear();
}
