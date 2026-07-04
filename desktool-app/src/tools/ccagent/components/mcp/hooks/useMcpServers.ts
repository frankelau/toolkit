// useMcpServers — MCP 服务器状态管理 hook
// Sprint C: 服务器列表 CRUD + 状态查询

import { useState, useCallback, useEffect } from "react";
import type { McpServer, McpServerStatusInfo, ServerToolsState, McpTool } from "../types";
import { parseMcpConfig, serializeMcpConfig } from "../utils";
import { addMcpServer } from "../../../utils/backendCommands";
import { getCachedTools, setCachedTools } from "../utils";

export interface UseMcpServersReturn {
  servers: McpServer[];
  configJson: string;
  setConfigJson: (json: string) => void;
  serverStatus: Record<string, McpServerStatusInfo>;
  toolsState: ServerToolsState;
  expandedId: string | null;
  /** 从 JSON 配置加载服务器列表 */
  loadFromConfig: (json: string) => void;
  /** 导出为 JSON 配置 */
  exportConfig: () => string;
  /** 添加服务器 */
  addServer: (server: McpServer) => void;
  /** 更新服务器 */
  updateServer: (id: string, updates: Partial<McpServer>) => void;
  /** 删除服务器 */
  removeServer: (id: string) => void;
  /** 切换启用状态 */
  toggleServer: (id: string) => void;
  /** 展开服务器（查看工具列表） */
  setExpandedId: (id: string | null) => void;
  /** 刷新服务器状态 */
  refreshStatus: (id: string) => Promise<void>;
  /** 加载服务器工具列表 */
  loadTools: (id: string, forceRefresh?: boolean) => Promise<void>;
}

export function useMcpServers(initialConfig: string): UseMcpServersReturn {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [configJson, setConfigJson] = useState(initialConfig);
  const [serverStatus, setServerStatus] = useState<Record<string, McpServerStatusInfo>>({});
  const [toolsState, setToolsState] = useState<ServerToolsState>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 初始化：从 JSON 解析
  useEffect(() => {
    const parsed = parseMcpConfig(configJson);
    setServers(Object.values(parsed));
  }, [configJson]);

  const loadFromConfig = useCallback((json: string) => {
    setConfigJson(json);
    const parsed = parseMcpConfig(json);
    setServers(Object.values(parsed));
  }, []);

  const exportConfig = useCallback(() => {
    return serializeMcpConfig(servers);
  }, [servers]);

  const addServer = useCallback((server: McpServer) => {
    setServers(prev => [...prev, server]);
    addMcpServer(server as any).catch(() => {});
  }, []);

  const updateServer = useCallback((id: string, updates: Partial<McpServer>) => {
    setServers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const removeServer = useCallback((id: string) => {
    setServers(prev => prev.filter(s => s.id !== id));
    setServerStatus(prev => { const n = { ...prev }; delete n[id]; return n; });
    setToolsState(prev => { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  const toggleServer = useCallback((id: string) => {
    setServers(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }, []);

  const refreshStatus = useCallback(async (id: string) => {
    setServerStatus(prev => ({ ...prev, [id]: { status: "pending", lastChecked: Date.now() } }));
    // 模拟状态检查（真实需调后端）
    try {
      // 后端命令待实现，这里先标记为 connected
      setServerStatus(prev => ({ ...prev, [id]: { status: "connected", lastChecked: Date.now() } }));
    } catch {
      setServerStatus(prev => ({ ...prev, [id]: { status: "error", message: "连接失败", lastChecked: Date.now() } }));
    }
  }, []);

  const loadTools = useCallback(async (id: string, forceRefresh = false) => {
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = getCachedTools<McpTool[]>(id);
      if (cached) {
        setToolsState(prev => ({ ...prev, [id]: { tools: cached as McpTool[], loading: false } }));
        return;
      }
    }
    setToolsState(prev => ({ ...prev, [id]: { tools: [] as McpTool[], loading: true } }));
    try {
      // 后端命令待实现，返回空列表
      const tools: McpTool[] = [];
      setToolsState(prev => ({ ...prev, [id]: { tools: tools as McpTool[], loading: false } }));
      setCachedTools(id, tools);
    } catch (e) {
      setToolsState(prev => ({ ...prev, [id]: { tools: [] as McpTool[], loading: false, error: String(e) } }));
    }
  }, []);

  return {
    servers, configJson, setConfigJson,
    serverStatus, toolsState, expandedId,
    loadFromConfig, exportConfig,
    addServer, updateServer, removeServer, toggleServer,
    setExpandedId, refreshStatus, loadTools,
  };
}
