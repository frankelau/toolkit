// McpServerDialog — 添加/编辑 MCP 服务器弹窗
// Sprint C: 支持 stdio/http/sse 三种连接类型

import { useState, useEffect } from "react";
import type { McpServer, McpConnectionType, McpServerSpec } from "./types";
import { generateServerId } from "./utils";

interface McpServerDialogProps {
  isOpen: boolean;
  server: McpServer | null; // null=新建
  onSave: (server: McpServer) => void;
  onClose: () => void;
}

export function McpServerDialog({ isOpen, server, onSave, onClose }: McpServerDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<McpConnectionType>("stdio");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [env, setEnv] = useState("");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState("");

  useEffect(() => {
    if (server) {
      setName(server.name || server.id);
      setType(server.server.type || "stdio");
      setCommand(server.server.command || "");
      setArgs((server.server.args || []).join(" "));
      setEnv(JSON.stringify(server.server.env || {}, null, 2));
      setUrl(server.server.url || "");
      setHeaders(JSON.stringify(server.server.headers || {}, null, 2));
    } else {
      setName(""); setType("stdio"); setCommand(""); setArgs("");
      setEnv("{}"); setUrl(""); setHeaders("{}");
    }
  }, [server, isOpen]);

  if (!isOpen) return null;

  function save() {
    const spec: McpServerSpec = { type };
    if (type === "stdio") {
      spec.command = command;
      spec.args = args.trim() ? args.split(/\s+/) : [];
      try { spec.env = JSON.parse(env); } catch { /* ignore */ }
    } else {
      spec.url = url;
      try { spec.headers = JSON.parse(headers); } catch { /* ignore */ }
    }

    const result: McpServer = server
      ? { ...server, name, server: spec }
      : { id: generateServerId(name || "server"), name, server: spec, enabled: true };

    onSave(result);
    onClose();
  }

  return (
    <div className="cc-mcp-dialog-overlay" onClick={onClose}>
      <div className="cc-mcp-dialog" onClick={e => e.stopPropagation()}>
        <div className="cc-mcp-dialog-title">{server ? "编辑服务器" : "添加服务器"}</div>

        <div className="cc-mcp-field">
          <label>名称</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="如：filesystem" autoFocus />
        </div>

        <div className="cc-mcp-field">
          <label>连接类型</label>
          <select value={type} onChange={e => setType(e.target.value as McpConnectionType)}>
            <option value="stdio">stdio（本地命令）</option>
            <option value="http">http（HTTP 服务）</option>
            <option value="sse">sse（SSE 服务）</option>
          </select>
        </div>

        {type === "stdio" ? (
          <>
            <div className="cc-mcp-field">
              <label>命令</label>
              <input value={command} onChange={e => setCommand(e.target.value)} placeholder="npx" />
            </div>
            <div className="cc-mcp-field">
              <label>参数（空格分隔）</label>
              <input value={args} onChange={e => setArgs(e.target.value)} placeholder="-y @modelcontextprotocol/server-filesystem ." />
            </div>
            <div className="cc-mcp-field">
              <label>环境变量（JSON）</label>
              <textarea value={env} onChange={e => setEnv(e.target.value)} rows={3} placeholder='{"KEY":"value"}' />
            </div>
          </>
        ) : (
          <>
            <div className="cc-mcp-field">
              <label>URL</label>
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="http://localhost:3000/mcp" />
            </div>
            <div className="cc-mcp-field">
              <label>请求头（JSON）</label>
              <textarea value={headers} onChange={e => setHeaders(e.target.value)} rows={3} placeholder='{"Authorization":"Bearer xxx"}' />
            </div>
          </>
        )}

        <div className="cc-mcp-dialog-actions">
          <button className="cc-mcp-cancel" onClick={onClose}>取消</button>
          <button className="cc-mcp-save" onClick={save} disabled={!name.trim()}>保存</button>
        </div>
      </div>
    </div>
  );
}
