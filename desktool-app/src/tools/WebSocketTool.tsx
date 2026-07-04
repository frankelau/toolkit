import { useEffect, useRef, useState } from "react";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { addEntry, updateEntry } from "./networkLog";
import { useSubTabs } from "./useSubTabs";
import SubTabBar from "./SubTabBar";
import NetworkPanel from "./NetworkPanel";
import BuiltinInput from "./BuiltinInput";
import { resolveBuiltins } from "./builtins";
import "./WebSocketTool.css";

type Status = "disconnected" | "connecting" | "connected";
interface LogEntry { dir: "in" | "out" | "sys"; text: string; time: string; json?: unknown; binary?: boolean; }
interface MsgTemplate { id: string; name: string; content: string; }

/** F06 WebSocket 工具 */
export default function WebSocketTool({ instanceId }: ToolProps) {
  const stb = useSubTabs(`ws:${instanceId}`, "连接 1");
  const ns = stb.subNs;
  const [url, setUrl] = usePersistentState(`${ns}:url`, "wss://echo.websocket.org");
  const [msg, setMsg] = usePersistentState(`${ns}:msg`, "");
  const [status, setStatus] = useState<Status>("disconnected");
  const [log, setLog] = usePersistentState<LogEntry[]>(`${ns}:log`, []);
  const [q, setQ] = usePersistentState(`${ns}:q`, "");
  const [expandedIdx, setExpandedIdx] = useState(new Set<number>());
  const [autoReconnect, setAutoReconnect] = usePersistentState(`${ns}:reconnect`, false);
  const [showHex, setShowHex] = useState(false);
  const [templates, setTemplates] = usePersistentState<MsgTemplate[]>(`ws:templates`, []);
  const [tplName, setTplName] = useState("");
  const [heartbeatInterval, setHeartbeatInterval] = usePersistentState(`${ns}:hb`, 0);
  const [stats, setStats] = useState({ sent: 0, received: 0 });
  const wsRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const connLogId = useRef<string | null>(null);
  const t0Ref = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUrl = useRef("");

  function addLog(dir: LogEntry["dir"], text: string, binary = false) {
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    let json: unknown;
    if (dir !== "sys" && !binary) { try { json = JSON.parse(text); } catch { } }
    if (dir === "in") setStats(s => ({ ...s, received: s.received + 1 }));
    if (dir === "out") setStats(s => ({ ...s, sent: s.sent + 1 }));
    setLog((l) => {
      const entry: LogEntry = { dir, text, time, ...(json !== undefined ? { json } : {}), ...(binary ? { binary: true } : {}) };
      const next = [...l, entry];
      return next.length > 500 ? next.slice(-500) : next;
    });
  }

  function toggleExpand(i: number) {
    setExpandedIdx(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [log]);
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    };
  }, []);

  // Heartbeat
  useEffect(() => {
    if (heartbeatTimer.current) { clearInterval(heartbeatTimer.current); heartbeatTimer.current = null; }
    if (heartbeatInterval > 0 && status === "connected") {
      heartbeatTimer.current = setInterval(() => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
          addLog("out", "ping [heartbeat]");
        }
      }, heartbeatInterval * 1000);
    }
    return () => { if (heartbeatTimer.current) clearInterval(heartbeatTimer.current); };
  }, [heartbeatInterval, status]);

  function connect() {
    if (!url.trim()) return;
    lastUrl.current = url.trim();
    try {
      setStatus("connecting");
      addLog("sys", `正在连接 ${url}…`);
      t0Ref.current = performance.now();
      const id = addEntry({ tool: "ws", type: "ws", url: url.trim(), state: "pending" });
      connLogId.current = id;
      const ws = new WebSocket(url.trim());
      wsRef.current = ws;
      ws.binaryType = "arraybuffer";
      ws.onopen = () => { setStatus("connected"); addLog("sys", "连接已建立"); updateEntry(id, { state: "done", duration: Math.round(performance.now() - t0Ref.current), statusText: "Connected" }); };
      ws.onmessage = (e) => {
        if (typeof e.data === "string") {
          addLog("in", e.data);
          addEntry({ tool: "ws", type: "ws", url: url.trim(), method: "←", resBody: e.data, state: "done", duration: 0 });
        } else {
          // Binary data
          const bytes = new Uint8Array(e.data);
          const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join(" ");
          addLog("in", `[二进制 ${bytes.length} bytes] ${showHex ? hex : ""}`, true);
          addEntry({ tool: "ws", type: "ws", url: url.trim(), method: "←", resBody: `[binary ${bytes.length}B]`, state: "done", duration: 0 });
        }
      };
      ws.onerror = () => { addLog("sys", "连接错误"); updateEntry(id, { state: "error", error: "WebSocket 错误" }); };
      ws.onclose = (e) => {
        setStatus("disconnected");
        addLog("sys", `连接关闭 (code ${e.code})`);
        updateEntry(id, { state: e.wasClean ? "done" : "error", statusText: `Closed ${e.code}` });
        // Auto reconnect
        if (autoReconnect && lastUrl.current) {
          addLog("sys", `将在 3 秒后自动重连…`);
          reconnectTimer.current = setTimeout(() => connect(), 3000);
        }
      };
    } catch (e) { setStatus("disconnected"); addLog("sys", `连接失败：${(e as Error).message}`); }
  }

  function disconnect() { wsRef.current?.close(); wsRef.current = null; }

  function send() {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) { addLog("sys", "未连接，无法发送"); return; }
    if (!msg) return;
    const resolved = resolveBuiltins(msg);
    ws.send(resolved);
    addLog("out", resolved);
    addEntry({ tool: "ws", type: "ws", url: url.trim(), method: "→", reqBody: resolved, state: "done", duration: 0 });
  }

  function saveTemplate() {
    if (!msg.trim()) return;
    const t: MsgTemplate = { id: crypto.randomUUID(), name: tplName.trim() || `模板 ${templates.length + 1}`, content: msg };
    setTemplates((ts) => [...ts, t]);
    setTplName("");
  }

  function loadTemplate(t: MsgTemplate) {
    setMsg(t.content);
  }

  function deleteTemplate(id: string) {
    setTemplates((ts) => ts.filter((t) => t.id !== id));
  }

  const statusLabel = { disconnected: "未连接", connecting: "连接中", connected: "已连接" }[status];
  const filtered = q ? log.filter(e => e.text.toLowerCase().includes(q.toLowerCase())) : log;

  return (
    <div className="ws-tool">
      <SubTabBar tabs={stb.tabs} activeId={stb.activeId} onSelect={stb.setActiveId} onAdd={stb.add} onDelete={stb.remove} onRename={stb.rename} />
      <div className="ws-bar">
        <span className={`ws-dot ${status}`} />
        <span className="ws-status">{statusLabel}</span>
        <input className="ws-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ws:// 或 wss:// 地址" disabled={status !== "disconnected"} />
        <label className="ws-opt" title="断开后自动重连">
          <input type="checkbox" checked={autoReconnect} onChange={(e) => setAutoReconnect(e.target.checked)} /> 自动重连
        </label>
        <label className="ws-opt" title="心跳间隔（秒），0=关闭">
          心跳
          <input type="number" min={0} max={300} value={heartbeatInterval} onChange={(e) => setHeartbeatInterval(Number(e.target.value))} style={{ width: 50 }} />s
        </label>
        <label className="ws-opt" title="二进制消息显示为 Hex">
          <input type="checkbox" checked={showHex} onChange={(e) => setShowHex(e.target.checked)} /> Hex
        </label>
        <span className="ws-stats" title="发送/接收计数">↑{stats.sent} ↓{stats.received}</span>
        {status === "disconnected"
          ? <button className="ws-connect" onClick={connect}>连接</button>
          : <button className="ws-disconnect" onClick={disconnect}>断开</button>}
      </div>

      <div className="ws-search">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索消息…" />
        {q && <span className="ws-search-count">{filtered.length} / {log.length} 条</span>}
      </div>

      <div className="ws-log">
        {filtered.length === 0 ? (
          <div className="ws-empty">{log.length === 0 ? "连接后这里显示收发消息" : "无匹配消息"}</div>
        ) : filtered.map((e, i) => (
          <div key={i} className={`ws-line ws-${e.dir}`} onClick={() => e.json !== undefined && toggleExpand(i)}>
            <span className="ws-time">{e.time}</span>
            <span className="ws-arrow">{e.dir === "in" ? "↓" : e.dir === "out" ? "↑" : "•"}</span>
            <span className="ws-text">{e.text}</span>
            {e.json !== undefined && <span className="ws-json-badge">JSON</span>}
            {e.json !== undefined && expandedIdx.has(i) && (
              <pre className="ws-expanded">{JSON.stringify(e.json, null, 2)}</pre>
            )}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>

      <div className="ws-send">
        {templates.length > 0 && (
          <div className="ws-templates">
            {templates.map((t) => (
              <div key={t.id} className="ws-tpl-item">
                <button className="ws-tpl-btn" onClick={() => loadTemplate(t)} title={t.content}>{t.name}</button>
                <button className="ws-tpl-del" onClick={() => deleteTemplate(t.id)}>×</button>
              </div>
            ))}
          </div>
        )}
        <BuiltinInput
          multiline
          className="ws-msg"
          value={msg}
          onChange={setMsg}
          placeholder="要发送的消息…（Ctrl/Cmd+Enter 发送）"
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send(); }}
        />
        <div className="ws-send-actions">
          <input className="ws-tpl-name" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="模板名" />
          <button onClick={saveTemplate} disabled={!msg.trim()} title="保存当前消息为模板">存模板</button>
          <button onClick={() => setLog([])}>清空记录</button>
          <button className="ws-send-btn" onClick={send} disabled={status !== "connected" || !msg}>发送</button>
        </div>
      </div>
      <NetworkPanel tool="ws" />
    </div>
  );
}
