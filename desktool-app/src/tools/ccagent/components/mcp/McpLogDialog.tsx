// McpLogDialog — MCP 刷新日志弹窗
// Sprint C: 显示服务器状态刷新日志

import type { RefreshLog } from "./types";

interface McpLogDialogProps {
  isOpen: boolean;
  logs: RefreshLog[];
  onClear: () => void;
  onClose: () => void;
}

export function McpLogDialog({ isOpen, logs, onClear, onClose }: McpLogDialogProps) {
  if (!isOpen) return null;
  return (
    <div className="cc-mcp-dialog-overlay" onClick={onClose}>
      <div className="cc-mcp-log-dialog" onClick={e => e.stopPropagation()}>
        <div className="cc-mcp-dialog-title">
          📋 刷新日志
          <button className="cc-mcp-log-clear" onClick={onClear}>清空</button>
        </div>
        <div className="cc-mcp-log-list">
          {logs.length === 0 ? (
            <div className="cc-mcp-log-empty">暂无日志</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className={`cc-mcp-log-item cc-mcp-log-${log.type}`}>
                <span className="cc-mcp-log-time">{new Date(log.timestamp).toLocaleTimeString("zh-CN")}</span>
                <span className="cc-mcp-log-icon">
                  {log.type === "success" ? "✓" : log.type === "error" ? "✗" : log.type === "warning" ? "⚠" : "ℹ"}
                </span>
                <span className="cc-mcp-log-msg">{log.message}</span>
                {log.serverName && <span className="cc-mcp-log-server">[{log.serverName}]</span>}
              </div>
            ))
          )}
        </div>
        <div className="cc-mcp-dialog-actions">
          <button className="cc-mcp-save" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
