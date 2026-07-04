// MCP 模块 barrel exports — Sprint C

export { McpSettingsSection } from "./McpSettingsSection";
export { ServerCard } from "./ServerCard";
export { ServerToolsPanel } from "./ServerToolsPanel";
export { McpServerDialog } from "./McpServerDialog";
export { McpPresetDialog } from "./McpPresetDialog";
export { McpConfirmDialog } from "./McpConfirmDialog";
export { McpHelpDialog } from "./McpHelpDialog";
export { McpLogDialog } from "./McpLogDialog";
export { useMcpServers } from "./hooks/useMcpServers";

export type {
  McpServer, McpServerSpec, McpConnectionType, McpServerStatus,
  McpServerStatusInfo, McpTool, ServerToolsState, RefreshLog,
  McpPreset, McpConfig,
} from "./types";

export { MCP_PRESETS } from "./utils/presets";
export {
  generateServerId, getServerInitial, getIconColor,
  getStatusIcon, getStatusColor, getStatusText, isServerEnabled,
  parseMcpConfig, serializeMcpConfig, getConnectionTypeText,
} from "./utils";
