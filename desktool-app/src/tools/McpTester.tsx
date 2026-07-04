import { useState } from "react";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import {
  mcpInitialize,
  mcpList,
  mcpCallTool,
  mcpReadResource,
  type McpSession,
} from "./mcpClient";
import "./McpTester.css";
import NetworkPanel from "./NetworkPanel";
import { useSubTabs } from "./useSubTabs";
import SubTabBar from "./SubTabBar";

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: { properties?: Record<string, { type?: string; description?: string }>; required?: string[] };
}

interface McpResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

interface McpPromptArg {
  name: string;
  description?: string;
  required?: boolean;
}

interface McpPrompt {
  name: string;
  description?: string;
  arguments?: McpPromptArg[];
}

function parseAuthHeader(raw: string): Record<string, string> {
  const idx = raw.indexOf(": ");
  if (idx < 0) return {};
  return { [raw.slice(0, idx)]: raw.slice(idx + 2) };
}

export default function McpTester({ instanceId }: ToolProps) {
  const stb = useSubTabs(`mcp:${instanceId}`, "服务 1");
  const ns = stb.subNs;
  const [endpoint, setEndpoint] = usePersistentState(`${ns}:endpoint`, "http://localhost:3000/mcp");
  const [authHeader, setAuthHeader] = usePersistentState(`${ns}:authHeader`, "");
  const [authOpen, setAuthOpen] = usePersistentState(`${ns}:authOpen`, false);
  const [savedServers, setSavedServers] = usePersistentState<{ name: string; endpoint: string; authHeader: string }[]>(`mcp:servers`, []);
  const [session, setSession] = useState<McpSession | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [resources, setResources] = useState<McpResource[]>([]);
  const [prompts, setPrompts] = useState<McpPrompt[]>([]);
  const [status, setStatus] = useState<{ kind: "" | "ok" | "err"; msg: string }>({ kind: "", msg: "" });
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<McpTool | null>(null);
  const [argsText, setArgsText] = useState("{}");
  const [callResult, setCallResult] = useState("");
  const [readingUri, setReadingUri] = useState("");
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

  const extraHeaders = parseAuthHeader(authHeader.trim());

  async function connect() {
    setBusy(true);
    setStatus({ kind: "", msg: "连接中…" });
    setTools([]); setResources([]); setPrompts([]);
    setSelected(null); setCallResult("");
    try {
      const init = await mcpInitialize(endpoint.trim(), extraHeaders);
      setSession(init.session);
      const caps = init.capabilities;
      const [t, r, p] = await Promise.all([
        caps.tools ? mcpList(init.session, "tools", extraHeaders).catch(() => []) : Promise.resolve([]),
        caps.resources ? mcpList(init.session, "resources", extraHeaders).catch(() => []) : Promise.resolve([]),
        caps.prompts ? mcpList(init.session, "prompts", extraHeaders).catch(() => []) : Promise.resolve([]),
      ]);
      setTools(t as McpTool[]);
      setResources(r as McpResource[]);
      setPrompts(p as McpPrompt[]);
      setStatus({ kind: "ok", msg: `已连接 ${init.serverInfo.name ?? ""} ${init.serverInfo.version ?? ""}`.trim() });
    } catch (e) {
      setSession(null);
      setStatus({ kind: "err", msg: `连接失败：${(e as Error).message}` });
    } finally { setBusy(false); }
  }

  function selectTool(t: McpTool) {
    setSelected(t); setCallResult("");
    const props = t.inputSchema?.properties ?? {};
    const tpl: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      tpl[k] = v.type === "number" ? 0 : v.type === "boolean" ? false : "";
    }
    setArgsText(JSON.stringify(tpl, null, 2));
  }

  async function callTool() {
    if (!session || !selected) return;
    setBusy(true); setCallResult("调用中…");
    try {
      const args = argsText.trim() ? JSON.parse(argsText) : {};
      const result = await mcpCallTool(session, selected.name, args, extraHeaders);
      setCallResult(JSON.stringify(result, null, 2));
    } catch (e) {
      setCallResult(`调用失败：${(e as Error).message}`);
    } finally { setBusy(false); }
  }

  async function readResource(uri: string) {
    if (!session) return;
    setReadingUri(uri); setCallResult("读取中…"); setSelected(null);
    try {
      const result = await mcpReadResource(session, uri, extraHeaders);
      setCallResult(JSON.stringify(result, null, 2));
    } catch (e) {
      setCallResult(`读取失败：${(e as Error).message}`);
    } finally { setReadingUri(""); }
  }

  function saveServer() {
    if (!endpoint.trim()) return;
    const name = endpoint.replace(/^https?:\/\//, "").split("/")[0] || endpoint.slice(0, 30);
    setSavedServers(prev => {
      if (prev.some(s => s.endpoint === endpoint)) return prev;
      return [...prev, { name, endpoint, authHeader }];
    });
  }

  function loadServer(s: { endpoint: string; authHeader: string }) {
    setEndpoint(s.endpoint);
    setAuthHeader(s.authHeader);
  }

  function deleteServer(idx: number) {
    setSavedServers(prev => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="mcp-tool">
      <SubTabBar tabs={stb.tabs} activeId={stb.activeId} onSelect={stb.setActiveId} onAdd={stb.add} onDelete={stb.remove} onRename={stb.rename} />
      <div className="mcp-conn">
        <input className="mcp-endpoint" value={endpoint} onChange={(e) => setEndpoint(e.target.value)}
          placeholder="MCP 服务地址，如 http://localhost:3000/mcp" onKeyDown={(e) => e.key === "Enter" && connect()} />
        <button className="mcp-connect" onClick={connect} disabled={busy}>{busy ? "…" : "连接"}</button>
        <button className="mcp-save-srv" onClick={saveServer} title="保存当前连接">💾</button>
      </div>
      {savedServers.length > 0 && (
        <div className="mcp-saved-srvs">
          {savedServers.map((s, i) => (
            <button key={i} className="mcp-saved-srv" onClick={() => loadServer(s)} title={s.endpoint}>
              {s.name}
              <span className="mcp-srv-del" onClick={(e) => { e.stopPropagation(); deleteServer(i); }}>×</span>
            </button>
          ))}
        </div>
      )}
      <div className="mcp-auth-row">
        <button className="mcp-auth-toggle" onClick={() => setAuthOpen(!authOpen)}>
          Auth{authHeader.trim() && !authOpen ? <span className="mcp-auth-configured"> 已配置</span> : null}
        </button>
        {authOpen && (
          <input className="mcp-auth-input" value={authHeader} onChange={(e) => setAuthHeader(e.target.value)}
            placeholder="Authorization: Bearer token" />
        )}
      </div>

      {status.kind && (
        <div className={`mcp-status ${status.kind}`}>
          {status.msg}
          {session?.sessionId && <span className="mcp-sid">session: {session.sessionId.slice(0, 12)}…</span>}
        </div>
      )}

      {session && (
        <div className="mcp-body">
          <div className="mcp-lists">
            <div className="mcp-section">
              <div className="mcp-section-title">Tools <span>({tools.length})</span></div>
              <div className="mcp-items">
                {tools.map((t) => (
                  <button key={t.name} className={`mcp-item ${selected?.name === t.name ? "active" : ""}`}
                    onClick={() => selectTool(t)} title={t.description}>
                    <span className="mcp-item-name">{t.name}</span>
                    {t.description && <span className="mcp-item-desc">{t.description}</span>}
                  </button>
                ))}
                {!tools.length && <div className="mcp-empty">无</div>}
              </div>
            </div>

            <div className="mcp-section">
              <div className="mcp-section-title">
                Resources <span>({resources.length})</span> · Prompts <span>({prompts.length})</span>
              </div>
              <div className="mcp-items">
                {resources.map((r) => (
                  <div key={r.uri} className="mcp-resource-item">
                    <div className="mcp-item-info">
                      <span className="mcp-item-name">{r.name ?? r.uri}</span>
                      {r.description && <span className="mcp-item-desc">{r.description}</span>}
                      {r.name && <span className="mcp-item-desc" style={{ fontFamily: "var(--mono)" }}>{r.uri}</span>}
                    </div>
                    <button className="mcp-read-btn" disabled={busy || readingUri === r.uri}
                      onClick={() => readResource(r.uri)}>
                      {readingUri === r.uri ? "…" : "读取"}
                    </button>
                  </div>
                ))}
                {resources.length > 0 && prompts.length > 0 && <div className="mcp-divider" />}
                {prompts.map((p) => (
                  <div key={p.name} className="mcp-prompt-item"
                    onClick={() => setExpandedPrompt(expandedPrompt === p.name ? null : p.name)}>
                    <div className="mcp-item-name">{p.name}</div>
                    {p.description && <div className="mcp-item-desc">{p.description}</div>}
                    {expandedPrompt === p.name && p.arguments && p.arguments.length > 0 && (
                      <div className="mcp-prompt-args">
                        {p.arguments.map((a) => (
                          <div key={a.name} className="mcp-item-desc">
                            <span className="mcp-item-name">{a.name}</span>
                            {a.required && <span> *</span>}
                            {a.description && <span> — {a.description}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {!resources.length && !prompts.length && <div className="mcp-empty">无</div>}
              </div>
            </div>
          </div>

          <div className="mcp-call">
            {selected && (
              <>
                <div className="mcp-call-title">调用 {selected.name}</div>
                <textarea className="mcp-args" value={argsText} onChange={(e) => setArgsText(e.target.value)}
                  spellCheck={false} placeholder="参数 JSON" />
                <button className="mcp-run" onClick={callTool} disabled={busy}>执行</button>
              </>
            )}
            {callResult
              ? <pre className="mcp-result">{callResult}</pre>
              : !selected && <div className="mcp-empty">选择左侧一个 Tool 进行调用</div>
            }
          </div>
        </div>
      )}
      <NetworkPanel tool="mcp" />
    </div>
  );
}
