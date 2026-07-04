// mcp/utils/serverUtils.ts — B6-3: MCP服务器状态工具函数
// 对齐 cc-gui serverUtils.ts (276行)
// 适配 ccagent McpServer 类型 (字段精简版)

import type { McpServer } from "../types";

/** 图标颜色常量 */
export const iconColors = {
  running: "#22c55e",
  connecting: "#f59e0b",
  error: "#ef4444",
  disabled: "#6b7280",
  unknown: "#9ca3af",
} as const;

/** 服务器状态信息 (运行时推断) */
export interface ServerStatusInfo {
  label: string;
  className: string;
  tooltip: string;
}

/** 获取服务器状态信息 */
export function getServerStatusInfo(
  server: McpServer & { status?: string; toolCount?: number; errorMessage?: string },
): ServerStatusInfo {
  if (!server.enabled) {
    return {
      label: "已禁用",
      className: "mcp-status-disabled",
      tooltip: "服务器已禁用",
    };
  }

  switch (server.status) {
    case "connected":
      return {
        label: `已连接 ${server.toolCount != null ? `(${server.toolCount} 工具)` : ""}`,
        className: "mcp-status-connected",
        tooltip: "服务器连接正常",
      };
    case "connecting":
      return {
        label: "连接中...",
        className: "mcp-status-connecting",
        tooltip: "正在建立连接",
      };
    case "error":
      return {
        label: "连接失败",
        className: "mcp-status-error",
        tooltip: server.errorMessage ?? "未知错误",
      };
    default:
      return {
        label: "已启用",
        className: "mcp-status-unknown",
        tooltip: "状态未知",
      };
  }
}

/** 检查服务器是否在指定模式下可用 */
export function isServerEnabled(
  server: McpServer & { providerRestriction?: string },
  isCodexMode: boolean,
): boolean {
  if (!server.enabled) return false;
  if (server.providerRestriction) {
    const expected = isCodexMode ? "codex" : "claude";
    return server.providerRestriction === expected;
  }
  return true;
}

/** 获取状态图标 */
export function getStatusIcon(
  server: McpServer & { status?: string },
): string {
  if (!server.enabled) return "⏸";
  switch (server.status) {
    case "connected": return "✓";
    case "connecting": return "⟳";
    case "error": return "✗";
    default: return "?";
  }
}

/** 获取状态颜色 */
export function getStatusColor(
  server: McpServer & { status?: string },
): string {
  if (!server.enabled) return iconColors.disabled;
  switch (server.status) {
    case "connected": return iconColors.running;
    case "connecting": return iconColors.connecting;
    case "error": return iconColors.error;
    default: return iconColors.unknown;
  }
}

/** 格式化工具数量 */
export function formatToolCount(count: number | undefined): string {
  if (count === undefined) return "—";
  if (count === 0) return "无工具";
  return `${count} 个工具`;
}

/** 检查服务器是否可以刷新工具列表 */
export function canRefreshTools(
  server: McpServer & { status?: string },
): boolean {
  return Boolean(server.enabled);
}

/** 获取服务器类型标签 */
export function getServerTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    stdio: "本地进程",
    sse: "SSE",
    streamableHttp: "Streamable HTTP",
    websocket: "WebSocket",
    http: "HTTP",
  };
  return labels[type] ?? type;
}
