// MCP 类型定义 — Sprint C（对齐 cc-gui types/mcp.ts）

/** MCP 服务器连接类型 */
export type McpConnectionType = "stdio" | "http" | "sse";

/** MCP 服务器连接规格 */
export interface McpServerSpec {
  type?: McpConnectionType;
  // stdio
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  // http/sse
  url?: string;
  headers?: Record<string, string>;
  [key: string]: unknown;
}

/** MCP 服务器完整配置 */
export interface McpServer {
  id: string;
  name?: string;
  server: McpServerSpec;
  apps?: { claude: boolean; codex: boolean };
  enabled?: boolean;
}

/** MCP 服务器状态 */
export type McpServerStatus = "connected" | "disconnected" | "error" | "pending";

export interface McpServerStatusInfo {
  status: McpServerStatus;
  message?: string;
  lastChecked?: number;
}

/** MCP 工具 */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/** 服务器工具列表状态 */
export interface ServerToolsState {
  [serverId: string]: {
    tools: McpTool[];
    loading: boolean;
    error?: string;
  };
}

/** 刷新日志 */
export interface RefreshLog {
  id: string;
  timestamp: number;
  type: "info" | "success" | "error" | "warning";
  message: string;
  serverId?: string;
  serverName?: string;
}

/** MCP 预设 */
export interface McpPreset {
  name: string;
  description: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/** MCP 配置文件根结构 */
export interface McpConfig {
  mcpServers: Record<string, McpServerSpec>;
}
