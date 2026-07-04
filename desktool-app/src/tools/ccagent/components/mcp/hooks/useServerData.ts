/**
 * MCP Server Data Loading Hook
 * 对齐 cc-gui components/mcp/hooks/useServerData.ts
 * 适配: sendToJava → invoke, window callbacks → listen
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { McpServer, McpServerStatusInfo, ServerToolsState } from "../types";
import { getCachedTools, setCachedTools } from "../utils";

export interface UseServerDataReturn {
  servers: McpServer[];
  serverStatus: Map<string, McpServerStatusInfo>;
  loading: boolean;
  statusLoading: boolean;
  serverTools: ServerToolsState;
  expandedServers: Set<string>;
  setServers: React.Dispatch<React.SetStateAction<McpServer[]>>;
  setServerStatus: React.Dispatch<React.SetStateAction<Map<string, McpServerStatusInfo>>>;
  setServerTools: React.Dispatch<React.SetStateAction<ServerToolsState>>;
  setExpandedServers: React.Dispatch<React.SetStateAction<Set<string>>>;
  loadServers: () => void;
  loadServerStatus: () => void;
  loadServerTools: (server: McpServer, forceRefresh?: boolean) => void;
}

export function useServerData(): UseServerDataReturn {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [serverStatus, setServerStatus] = useState<Map<string, McpServerStatusInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [serverTools, setServerTools] = useState<ServerToolsState>({});
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const unlistenersRef = useRef<UnlistenFn[]>([]);

  const loadServers = useCallback(() => {
    setLoading(true);
    invoke<McpServer[]>("cc_list_mcp_servers")
      .then((list) => {
        setServers(list);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[MCP] loadServers failed:", err);
        setLoading(false);
      });
  }, []);

  const loadServerStatus = useCallback(() => {
    setStatusLoading(true);
    invoke<McpServerStatusInfo[]>("cc_get_mcp_server_status")
      .then((list) => {
        const map = new Map<string, McpServerStatusInfo>();
        list.forEach((s) => { const id = (s as { name?: string; id?: string }).name || (s as { id?: string }).id || ""; if (id) map.set(id, s); });
        setServerStatus(map);
        setStatusLoading(false);
      })
      .catch((err) => {
        console.error("[MCP] loadServerStatus failed:", err);
        setStatusLoading(false);
      });
  }, []);

  const loadServerTools = useCallback((server: McpServer, forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCachedTools<Array<{ name: string; description?: string; inputSchema?: unknown }>>(server.id);
      if (cached && cached.length > 0) {
        setServerTools(prev => ({
          ...prev,
          [server.id]: { tools: cached as never, loading: false },
        }));
        return;
      }
    }
    setServerTools(prev => ({ ...prev, [server.id]: { tools: [] as never, loading: true } }));
    invoke<Array<{ name: string; description?: string; inputSchema?: unknown }>>("cc_get_mcp_tools", { serverId: server.id })
      .then((tools) => {
        setServerTools(prev => ({ ...prev, [server.id]: { tools: tools as never, loading: false } }));
        setCachedTools(server.id, tools);
      })
      .catch((err) => {
        setServerTools(prev => ({ ...prev, [server.id]: { tools: [] as never, loading: false, error: String(err) } }));
      });
  }, []);

  // Initial load + event listeners
  useEffect(() => {
    loadServers();
    loadServerStatus();

    // Listen for backend-pushed MCP events
    listen("cc-mcp-servers-updated", () => loadServers())
      .then(fn => unlistenersRef.current.push(fn));
    listen("cc-mcp-status-updated", () => loadServerStatus())
      .then(fn => unlistenersRef.current.push(fn));

    return () => { unlistenersRef.current.forEach(fn => fn()); };
  }, [loadServers, loadServerStatus]);

  return {
    servers, serverStatus, loading, statusLoading, serverTools, expandedServers,
    setServers, setServerStatus, setServerTools, setExpandedServers,
    loadServers, loadServerStatus, loadServerTools,
  };
}
