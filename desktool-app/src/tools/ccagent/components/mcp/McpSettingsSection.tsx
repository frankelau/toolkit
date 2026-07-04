// McpSettingsSection — MCP 设置区主组件
// Sprint C: 整合所有 MCP 子组件，提供完整可视化管理

import { useState, useCallback } from "react";
import { useMcpServers } from "./hooks/useMcpServers";
import { ServerCard } from "./ServerCard";
import { McpServerDialog } from "./McpServerDialog";
import { McpPresetDialog } from "./McpPresetDialog";
import { McpConfirmDialog } from "./McpConfirmDialog";
import { McpHelpDialog } from "./McpHelpDialog";
import { McpLogDialog } from "./McpLogDialog";
import type { McpServer, RefreshLog } from "./types";
import { getStatusText, getStatusColor } from "./utils";

interface McpSettingsSectionProps {
  config: string;
  onChange: (config: string) => void;
  isCodexMode?: boolean;
}

export function McpSettingsSection({ config, onChange, isCodexMode = false }: McpSettingsSectionProps) {
  const mcp = useMcpServers(config);
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);
  const [showServerDialog, setShowServerDialog] = useState(false);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showRawEditor, setShowRawEditor] = useState(false);
  const [rawConfig, setRawConfig] = useState(config);
  const [deleteTarget, setDeleteTarget] = useState<McpServer | null>(null);
  const [logs, setLogs] = useState<RefreshLog[]>([]);

  const addLog = useCallback((type: RefreshLog["type"], message: string, server?: McpServer) => {
    setLogs(prev => [...prev.slice(-99), {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(), type, message,
      serverId: server?.id, serverName: server?.name,
    }]);
  }, []);

  const handleAdd = (server: McpServer) => {
    mcp.addServer(server);
    addLog("success", `已添加服务器: ${server.name}`, server);
    syncToConfig([...mcp.servers, server]);
  };

  const handleUpdate = (server: McpServer) => {
    mcp.updateServer(server.id, server);
    addLog("info", `已更新服务器: ${server.name}`, server);
    syncToConfig(mcp.servers.map(s => s.id === server.id ? server : s));
  };

  const handleDelete = (server: McpServer) => {
    setDeleteTarget(server);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    mcp.removeServer(deleteTarget.id);
    addLog("warning", `已删除服务器: ${deleteTarget.name}`, deleteTarget);
    syncToConfig(mcp.servers.filter(s => s.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleToggle = (server: McpServer, enabled: boolean) => {
    mcp.toggleServer(server.id);
    addLog("info", `${enabled ? "启用" : "停用"}: ${server.name}`, server);
  };

  const handleRefresh = async (server: McpServer) => {
    addLog("info", `开始刷新: ${server.name}`, server);
    await mcp.refreshStatus(server.id);
    const status = mcp.serverStatus[server.id];
    if (status?.status === "connected") {
      addLog("success", `连接成功: ${server.name}`, server);
    } else if (status?.status === "error") {
      addLog("error", `连接失败: ${server.name} - ${status.message}`, server);
    }
  };

  const handleCopy = (server: McpServer) => {
    const json = JSON.stringify({ mcpServers: { [server.id]: server.server } }, null, 2);
    navigator.clipboard.writeText(json);
    addLog("success", `已复制配置: ${server.name}`, server);
  };

  const syncToConfig = (servers: McpServer[]) => {
    const newConfig = JSON.stringify({
      mcpServers: Object.fromEntries(servers.map(s => [s.id, s.server])),
    }, null, 2);
    onChange(newConfig);
  };

  const applyRawConfig = () => {
    try {
      JSON.parse(rawConfig);
      mcp.loadFromConfig(rawConfig);
      onChange(rawConfig);
      setShowRawEditor(false);
      addLog("success", "已应用原始配置");
    } catch (e) {
      addLog("error", `JSON 解析失败: ${e}`);
    }
  };

  return (
    <div className="cc-mcp-section">
      <div className="cc-mcp-section-head">
        <span className="cc-section-title">🔌 MCP 服务器</span>
        <div className="cc-mcp-section-actions">
          <button className="cc-mcp-add-btn" onClick={() => setShowPresetDialog(true)}>⚡ 预设</button>
          <button className="cc-mcp-add-btn" onClick={() => { setEditingServer(null); setShowServerDialog(true); }}>+ 添加</button>
          <button className="cc-mcp-help-btn" onClick={() => setShowHelp(true)}>📖</button>
          <button className="cc-mcp-log-btn" onClick={() => setShowLog(true)}>📋</button>
          <button className="cc-mcp-raw-btn" onClick={() => { setRawConfig(mcp.exportConfig()); setShowRawEditor(!showRawEditor); }}>
            {showRawEditor ? "卡片视图" : "原始 JSON"}
          </button>
        </div>
      </div>

      {showRawEditor ? (
        <div className="cc-mcp-raw-editor">
          <textarea
            className="cc-mcp-raw-textarea"
            value={rawConfig}
            onChange={e => setRawConfig(e.target.value)}
            rows={12}
            spellCheck={false}
            placeholder='{"mcpServers":{}}'
          />
          <div className="cc-mcp-raw-actions">
            <button onClick={() => setShowRawEditor(false)}>取消</button>
            <button className="cc-mcp-save" onClick={applyRawConfig}>应用</button>
          </div>
        </div>
      ) : (
        <div className="cc-mcp-server-list">
          {mcp.servers.length === 0 ? (
            <div className="cc-mcp-empty">
              <div className="cc-mcp-empty-icon">🔌</div>
              <div>暂无 MCP 服务器</div>
              <div className="cc-mcp-empty-hint">点击「+ 添加」或「⚡ 预设」开始配置</div>
            </div>
          ) : (
            mcp.servers.map(server => {
              const status = mcp.serverStatus[server.id];
              return (
                <ServerCard
                  key={server.id}
                  server={server}
                  isExpanded={mcp.expandedId === server.id}
                  isCodexMode={isCodexMode}
                  statusText={getStatusText(status?.status)}
                  statusColor={getStatusColor(status?.status)}
                  onToggleExpand={() => mcp.setExpandedId(mcp.expandedId === server.id ? null : server.id)}
                  onToggleServer={(enabled) => handleToggle(server, enabled)}
                  onEdit={() => { setEditingServer(server); setShowServerDialog(true); }}
                  onDelete={() => handleDelete(server)}
                  onCopy={() => handleCopy(server)}
                  onRefresh={() => handleRefresh(server)}
                />
              );
            })
          )}
        </div>
      )}

      {/* 弹窗 */}
      <McpServerDialog
        isOpen={showServerDialog}
        server={editingServer}
        onSave={editingServer ? handleUpdate : handleAdd}
        onClose={() => setShowServerDialog(false)}
      />
      <McpPresetDialog
        isOpen={showPresetDialog}
        onAdd={handleAdd}
        onClose={() => setShowPresetDialog(false)}
      />
      <McpConfirmDialog
        isOpen={!!deleteTarget}
        title="删除服务器"
        message={`确认删除「${deleteTarget?.name}」？此操作不可撤销。`}
        confirmText="删除"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <McpHelpDialog isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <McpLogDialog
        isOpen={showLog}
        logs={logs}
        onClear={() => setLogs([])}
        onClose={() => setShowLog(false)}
      />
    </div>
  );
}
