// ServerCard — 单个 MCP 服务器卡片
// Sprint C: 显示服务器信息/状态/操作

import { useState } from "react";
import type { McpServer } from "./types";
import { ServerToolsPanel } from "./ServerToolsPanel";
import {
  getServerInitial, getIconColor,
  getStatusText, isServerEnabled, getConnectionTypeText,
} from "./utils";

interface ServerCardProps {
  server: McpServer;
  isExpanded: boolean;
  isCodexMode: boolean;
  statusText?: string;
  statusColor?: string;
  toolsInfo?: { tools: McpServer["server"][]; loading: boolean; error?: string };
  onToggleExpand: () => void;
  onToggleServer: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onRefresh: () => void;
}

export function ServerCard({
  server, isExpanded, isCodexMode,
  statusText, statusColor,
  onToggleExpand, onToggleServer, onEdit, onDelete, onCopy, onRefresh,
}: ServerCardProps) {
  const [showActions, setShowActions] = useState(false);
  const enabled = isServerEnabled(server, isCodexMode);
  const initial = getServerInitial(server);
  const iconColor = getIconColor(server.id);
  const connText = getConnectionTypeText(server);

  return (
    <div className={`cc-mcp-card ${!enabled ? "cc-mcp-card-disabled" : ""}`}>
      <div className="cc-mcp-card-header" onClick={onToggleExpand}>
        <div className="cc-mcp-card-icon" style={{ background: iconColor }}>{initial}</div>
        <div className="cc-mcp-card-info">
          <div className="cc-mcp-card-name">{server.name || server.id}</div>
          <div className="cc-mcp-card-conn">{connText}</div>
        </div>
        <div className="cc-mcp-card-status" style={{ color: statusColor }}>
          {statusText || getStatusText()}
        </div>
        <button
          className="cc-mcp-card-toggle"
          onClick={(e) => { e.stopPropagation(); onToggleServer(!enabled); }}
          title={enabled ? "停用" : "启用"}
        >
          {enabled ? "🟢" : "⚪"}
        </button>
        <button
          className="cc-mcp-card-actions-btn"
          onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
          title="操作"
        >
          ⋮
        </button>
        <span className="cc-mcp-card-chevron">{isExpanded ? "▼" : "▶"}</span>
      </div>

      {showActions && (
        <div className="cc-mcp-card-actions-menu">
          <button onClick={() => { onEdit(); setShowActions(false); }}>✏️ 编辑</button>
          <button onClick={() => { onCopy(); setShowActions(false); }}>📋 复制配置</button>
          <button onClick={() => { onRefresh(); setShowActions(false); }}>🔄 刷新状态</button>
          <button className="cc-mcp-card-danger" onClick={() => { onDelete(); setShowActions(false); }}>🗑️ 删除</button>
        </div>
      )}

      {isExpanded && (
        <div className="cc-mcp-card-body">
          <ServerToolsPanel serverId={server.id} />
        </div>
      )}
    </div>
  );
}
