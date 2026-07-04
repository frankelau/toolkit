/**
 * MCP Tools Update Hook — 工具列表自动刷新 & 轮询
 * 对齐 cc-gui components/mcp/hooks/useToolsUpdate.ts
 * 适配: sendToJava → invoke
 */

import { useEffect, useRef, useCallback } from "react";
import type { McpServer } from "../types";

export interface UseToolsUpdateOptions {
  loadServerTools: (server: McpServer, forceRefresh?: boolean) => void;
  servers: McpServer[];
  /** 自动刷新间隔 (ms)，默认 0 表示不轮询 */
  autoRefreshInterval?: number;
}

export function useToolsUpdate({
  loadServerTools,
  servers,
  autoRefreshInterval = 0,
}: UseToolsUpdateOptions) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expandedRef = useRef<Set<string>>(new Set());

  const refreshToolsFor = useCallback((serverId: string) => {
    const server = servers.find(s => s.id === serverId);
    if (server) loadServerTools(server, true);
  }, [servers, loadServerTools]);

  const refreshAllTools = useCallback(() => {
    servers.forEach(s => {
      if (expandedRef.current.has(s.id)) {
        loadServerTools(s, true);
      }
    });
  }, [servers, loadServerTools]);

  // Track which servers were expanded
  const markExpanded = useCallback((serverId: string, isExpanded: boolean) => {
    if (isExpanded) expandedRef.current.add(serverId);
    else expandedRef.current.delete(serverId);
  }, []);

  // Auto-refresh polling
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    timerRef.current = setInterval(refreshAllTools, autoRefreshInterval);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefreshInterval, refreshAllTools]);

  return { refreshToolsFor, refreshAllTools, markExpanded };
}
