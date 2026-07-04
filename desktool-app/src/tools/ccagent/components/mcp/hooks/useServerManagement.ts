/**
 * MCP Server Management Operations Hook
 * 对齐 cc-gui components/mcp/hooks/useServerManagement.ts
 * 适配: sendToJava → invoke
 */

import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { McpServer, ServerToolsState } from "../types";
import { clearToolCache } from "../utils";

export interface ServerRefreshState {
  [serverId: string]: { isRefreshing: boolean; step: string };
}

export interface UseServerManagementReturn {
  serverRefreshStates: ServerRefreshState;
  handleRefresh: () => void;
  handleRefreshSingleServer: (server: McpServer, forceRefreshTools?: boolean) => void;
  handleToggleServer: (server: McpServer, enabled: boolean) => void;
}

export function useServerManagement(
  setServerTools: React.Dispatch<React.SetStateAction<ServerToolsState>>,
  loadServers: () => void,
  loadServerStatus: () => void,
  loadServerTools: (server: McpServer, forceRefresh?: boolean) => void,
): UseServerManagementReturn {
  const [serverRefreshStates, setServerRefreshStates] = useState<ServerRefreshState>({});

  const setServerRefreshing = useCallback((serverId: string, isRefreshing: boolean, step = "") => {
    setServerRefreshStates(prev => ({ ...prev, [serverId]: { isRefreshing, step } }));
  }, []);

  const handleRefresh = useCallback(() => {
    clearToolCache();
    setServerTools({});
    loadServers();
    loadServerStatus();
  }, [setServerTools, loadServers, loadServerStatus]);

  const handleRefreshSingleServer = useCallback((server: McpServer, forceRefreshTools = false) => {
    void (server.name || server.id);
    setServerRefreshing(server.id, true, "开始刷新…");

    if (forceRefreshTools) {
      clearToolCache();
      setServerTools(prev => { const next = { ...prev }; delete next[server.id]; return next; });
      loadServerTools(server, true);
    }

    setTimeout(() => {
      loadServerStatus();
      setServerRefreshing(server.id, false, "");
    }, 1500);
  }, [setServerTools, loadServerStatus, loadServerTools, setServerRefreshing]);

  const handleToggleServer = useCallback((server: McpServer, enabled: boolean) => {
    const updated = { ...server, enabled };
    invoke("cc_toggle_mcp_server", { server: updated })
      .catch(err => console.error("[MCP] toggle failed:", err));
    loadServers();
    loadServerStatus();
  }, [loadServers, loadServerStatus]);

  return { serverRefreshStates, handleRefresh, handleRefreshSingleServer, handleToggleServer };
}
