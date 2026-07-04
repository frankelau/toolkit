// ServerToolsPanel — 服务器工具列表面板
// Sprint C: 展开后显示 MCP 服务器提供的工具列表

import { useState, useEffect } from "react";
import type { McpTool } from "./types";

interface ServerToolsPanelProps {
  serverId: string;
  tools?: McpTool[];
  loading?: boolean;
  error?: string;
  onLoadTools?: () => void;
}

export function ServerToolsPanel({
  serverId, tools = [], loading = false, error, onLoadTools,
}: ServerToolsPanelProps) {
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  useEffect(() => {
    if (onLoadTools) onLoadTools();
  }, [serverId]);

  if (loading) {
    return <div className="cc-mcp-tools-loading">⏳ 加载工具列表...</div>;
  }

  if (error) {
    return <div className="cc-mcp-tools-error">❌ {error}</div>;
  }

  if (tools.length === 0) {
    return <div className="cc-mcp-tools-empty">暂无工具</div>;
  }

  return (
    <div className="cc-mcp-tools">
      <div className="cc-mcp-tools-title">工具 ({tools.length})</div>
      {tools.map(tool => (
        <div key={tool.name} className="cc-mcp-tool">
          <div
            className="cc-mcp-tool-header"
            onClick={() => setExpandedTool(expandedTool === tool.name ? null : tool.name)}
          >
            <span className="cc-mcp-tool-name">🔧 {tool.name}</span>
            {tool.description && <span className="cc-mcp-tool-desc">{tool.description.slice(0, 60)}</span>}
            <span className="cc-mcp-tool-chevron">{expandedTool === tool.name ? "▼" : "▶"}</span>
          </div>
          {expandedTool === tool.name && (
            <div className="cc-mcp-tool-detail">
              {tool.description && <div className="cc-mcp-tool-full-desc">{tool.description}</div>}
              {tool.inputSchema && (
                <div className="cc-mcp-tool-schema">
                  <div className="cc-mcp-tool-schema-title">输入参数</div>
                  <pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
