import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { useSubTabs } from "./useSubTabs";
import SubTabBar from "./SubTabBar";
import NetworkPanel from "./NetworkPanel";
import { marked, Renderer } from "marked";
import hljs from "highlight.js";
import DOMPurify from "dompurify";
import { saveTextWithDialog } from "../saveFile";
import { toast, copyText } from "../useCopyFeedback";
import { LOCAL_TOOLS } from "../agent/localTools";
import { loadMcpTools } from "../agent/toolRegistry";
import { runAgentLoop } from "../agent/agentLoop";
import { createSubagentTool, getAllSubagents } from "../agent/subagent";
import type { ServiceConfig, ToolStep } from "../agent/types";
import "highlight.js/styles/github-dark.css";
import "./AiChat.css";

type Protocol = "openai" | "claude";
interface Service {
  id: string; name: string; protocol: Protocol; baseUrl: string; apiKey: string; model: string;
  systemPrompt?: string; temperature?: number; maxTokens?: number;
}
interface MCPServer { id: string; name: string; url: string; headers?: Record<string, string>; enabled: boolean; }
interface AgentMode { id: string; name: string; icon: string; promptMode: "override" | "append"; content?: string; }
interface Message { role: "user" | "assistant"; content: string; toolSteps?: ToolStep[]; }

const DEFAULT_AGENT_MODES: AgentMode[] = [
  { id: "g1", name: "通用助手", icon: "🤖", promptMode: "override", content: "你是一个有帮助的AI助手，能回答问题、分析问题、编写代码等各类任务。" },
  { id: "g2", name: "代码专家", icon: "💻", promptMode: "override", content: "你是一位专业软件工程师，擅长代码审查、调试、架构设计和技术方案。" },
  { id: "g3", name: "写作助手", icon: "✍️", promptMode: "override", content: "你是一位专业写作助手，帮助用户撰写、润色、翻译和改进各类文章。" },
];

const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULTS: Record<Protocol, Partial<Service>> = {
  openai: { baseUrl: "https://api.openai.com", model: "gpt-4o" },
  claude: { baseUrl: "https://api.anthropic.com", model: "claude-opus-4-8" },
};

const mdRenderer = new Renderer();
mdRenderer.code = function({ text, lang }) {
  const highlighted = lang && hljs.getLanguage(lang)
    ? hljs.highlight(text, { language: lang }).value
    : hljs.highlightAuto(text).value;
  return `<pre class="ai-code-block"><code class="hljs language-${lang ?? ""}">${highlighted}</code></pre>`;
};
marked.use({ renderer: mdRenderer });

function renderMd(text: string): string {
  const raw = marked.parse(text);
  return DOMPurify.sanitize(typeof raw === "string" ? raw : "");
}

const TOOL_LABELS: Record<string, string> = {
  free_web_search: "🔍 搜索网页", free_image_search: "🖼️ 搜索图片",
  web_fetch: "📄 读取网页", calculate: "🧮 计算", delegate_to_subagent: "🤖 子代理",
};
function toolLabel(name: string, args: unknown): string {
  const base = TOOL_LABELS[name] ?? `🔧 ${name}`;
  const q = (args as Record<string, string>)?.query ?? (args as Record<string, string>)?.url;
  return q ? `${base}：${String(q).slice(0, 40)}` : base;
}

/** F20 AI 智能助手 */
export default function AiChat({ instanceId }: ToolProps) {
  const globalNs = `ai:${instanceId}`;
  const stb = useSubTabs(globalNs, "对话 1");
  const subNs = stb.subNs;
  const [services, setServices] = usePersistentState<Service[]>(`${globalNs}:svcs`, []);
  const [activeSvc, setActiveSvc] = usePersistentState(`${subNs}:svc`, "");
  const [messages, setMessages] = usePersistentState<Message[]>(`${subNs}:msgs`, []);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [tab, setTab] = useState<"chat" | "svc" | "mcp" | "skill">("chat");
  const [editSvc, setEditSvc] = useState<Service | null>(null);
  const [mcpServers, setMcpServers] = usePersistentState<MCPServer[]>(`${globalNs}:mcp`, []);
  const [agentModes, setAgentModes] = usePersistentState<AgentMode[]>(`${globalNs}:skills`, DEFAULT_AGENT_MODES);
  const [activeAgentId, setActiveAgentId] = usePersistentState(`${globalNs}:skillId`, "");
  const [editingMcp, setEditingMcp] = useState<MCPServer | null>(null);
  const [editingAgent, setEditingAgent] = useState<AgentMode | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const svc = useMemo(() => services.find((s) => s.id === activeSvc) ?? null, [services, activeSvc]);
  const activeAgent = useMemo(() => agentModes.find(a => a.id === activeAgentId) ?? null, [agentModes, activeAgentId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function effectiveSvc(): Service | null {
    if (!svc) return null;
    if (!activeAgent) return svc;
    const sp = activeAgent.promptMode === "override"
      ? (activeAgent.content ?? "")
      : [svc.systemPrompt ?? "", activeAgent.content ?? ""].filter(Boolean).join("\n\n");
    return { ...svc, systemPrompt: sp };
  }

  async function send() {
    const content = input.trim();
    if (!content || streaming) return;
    const esvc = effectiveSvc();
    if (!esvc) return;
    setInput("");
    const userMsg: Message = { role: "user", content };
    setMessages(prev => [...prev, userMsg]);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const mcpAgentTools = await loadMcpTools(mcpServers);
    const subagents = getAllSubagents();
    const subagentTool = createSubagentTool(subagents, esvc as ServiceConfig, [...LOCAL_TOOLS, ...mcpAgentTools]);
    const allTools = [...LOCAL_TOOLS, ...mcpAgentTools, subagentTool];

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
    let reply = "";
    const toolSteps: ToolStep[] = [];
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      const result = await runAgentLoop({
        service: esvc as ServiceConfig,
        messages: history,
        tools: allTools,
        callbacks: {
          onToken: (text: string) => {
            reply += text;
            flushSync(() => {
              setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: reply, toolSteps: [...toolSteps] }]);
            });
          },
          onToolStart: (name: string, args: unknown, source: "local" | "mcp") => {
            toolSteps.push({ name, args, source, pending: true });
            flushSync(() => {
              setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: reply, toolSteps: [...toolSteps] }]);
            });
          },
          onToolEnd: (name: string, res: string, source: "local" | "mcp") => {
            const s = toolSteps.find(s => s.name === name && s.pending);
            if (s) { s.result = res; s.pending = false; s.source = source; }
            flushSync(() => {
              setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: reply, toolSteps: [...toolSteps] }]);
            });
          },
        },
        maxRounds: 15,
        signal: ctrl.signal,
      });
      setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: result.text || reply, toolSteps: result.toolSteps as ToolStep[] }]);
    } catch (e) {
      setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: `❌ ${(e as Error).message}` }]);
    } finally {
      setStreaming(false);
    }
  }

  async function exportSession() {
    const text = messages.map(m => `### ${m.role === "user" ? "你" : (svc?.name ?? "AI")}\n\n${m.content}`).join("\n\n---\n\n");
    const res = await saveTextWithDialog(text, "chat.md");
    if (res.saved) toast("已保存到 " + res.path, "success");
  }

  const saveSvc = (s: Service) => {
    setServices(arr => { const i = arr.findIndex(x => x.id === s.id); return i >= 0 ? arr.map((x, j) => j === i ? s : x) : [...arr, s]; });
    if (!activeSvc) setActiveSvc(s.id);
    setEditSvc(null);
  };
  const deleteSvc = (id: string) => { setServices(arr => arr.filter(s => s.id !== id)); if (activeSvc === id) setActiveSvc(""); };

  return (
    <div className="ai-chat">
      <SubTabBar tabs={stb.tabs} activeId={stb.activeId} onSelect={stb.setActiveId} onAdd={stb.add} onDelete={stb.remove} onRename={stb.rename} />

      {/* tab bar */}
      <div className="ai-topbar">
        <div className="ai-tabs">
          {(["chat", "svc", "mcp", "skill"] as const).map(t => (
            <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {{ chat: "💬 对话", svc: "🔌 模型", mcp: "🔧 MCP", skill: "🎭 角色" }[t]}
            </button>
          ))}
        </div>
        {tab === "chat" && <>
          <button onClick={() => setMessages([])} style={{ marginLeft: "auto" }}>清空</button>
          <button onClick={exportSession} disabled={messages.length === 0}>导出</button>
        </>}
      </div>

      {/* ── 对话 tab ── */}
      {tab === "chat" && (
        <>
          {!svc && (
            <div className="ai-no-svc">⚠ 未配置模型服务 <button onClick={() => setTab("svc")}>去配置</button></div>
          )}
          <div className="ai-messages">
            {messages.length === 0 && (
              <div className="ai-welcome">
                <div className="ai-welcome-icon">{activeAgent?.icon ?? "🤖"}</div>
                <div className="ai-welcome-text">{activeAgent?.name ?? "智能助手"}</div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`ai-row ${m.role === "user" ? "ai-row-user" : ""}`}>
                <div className={`ai-avatar ${m.role === "user" ? "ai-avatar-user" : "ai-avatar-ai"}`}>
                  {m.role === "user" ? "Me" : (activeAgent?.icon ?? "🤖")}
                </div>
                <div className={`ai-bubble ${m.role === "user" ? "ai-bubble-user" : "ai-bubble-ai"}`}>
                  {m.role === "assistant" ? (
                    <>
                      {m.toolSteps && m.toolSteps.length > 0 && (
                        <div className="ai-tool-steps">
                          {m.toolSteps.filter(s => s.pending).map((s, j) => (
                            <div key={`p${j}`} className="ai-tool-thinking">
                              <span className="ai-tool-dot" /><span>{toolLabel(s.name, s.args)}</span>
                            </div>
                          ))}
                          {m.toolSteps.filter(s => !s.pending).map((s, j) => (
                            <details key={`d${j}`} className="ai-tool-step">
                              <summary>✓ {toolLabel(s.name, s.args)}</summary>
                              {s.result && <div className="ai-tool-result">{s.result}</div>}
                            </details>
                          ))}
                        </div>
                      )}
                      {streaming && i === messages.length - 1 && !m.content
                        ? <div className="ai-typing"><span /><span /><span /></div>
                        : <MarkdownContent content={m.content} />}
                    </>
                  ) : m.content}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="ai-input-area">
            <textarea className="ai-input" rows={3} value={input} onChange={e => setInput(e.target.value)}
              placeholder="输入消息…（Ctrl/Cmd+Enter 发送）"
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { void send(); } }}
              disabled={streaming} spellCheck={false} />
            <div className="ai-input-btns">
              {streaming
                ? <button className="ai-stop" onClick={() => { abortRef.current?.abort(); setStreaming(false); }}>停止</button>
                : <button className="ai-send" onClick={() => { void send(); }} disabled={!svc || !input.trim()}>发送</button>}
            </div>
          </div>
        </>
      )}

      {/* ── 模型 tab ── */}
      {tab === "svc" && (
        <div className="ai-settings-body">
          <div className="ai-svc-list">
            {services.map(s => (
              <div key={s.id} className={`ai-svc-item ${activeSvc === s.id ? "on" : ""}`}>
                <div className="ai-svc-item-info" onClick={() => { setActiveSvc(s.id); setTab("chat"); }}>
                  <div className="ai-svc-item-name">{s.name}</div>
                  <div className="ai-svc-item-meta">{s.protocol} · {s.model}</div>
                </div>
                <button onClick={() => setEditSvc(s)}>编辑</button>
                <button onClick={() => deleteSvc(s.id)}>删除</button>
              </div>
            ))}
          </div>
          <div className="ai-svc-add-row">
            <button onClick={() => setEditSvc({ id: uid(), name: "OpenAI", protocol: "openai", apiKey: "", ...DEFAULTS.openai } as Service)}>+ OpenAI 格式</button>
            <button onClick={() => setEditSvc({ id: uid(), name: "Claude", protocol: "claude", apiKey: "", ...DEFAULTS.claude } as Service)}>+ Claude 格式</button>
          </div>
          {editSvc && <SvcEditor svc={editSvc} onChange={setEditSvc} onSave={saveSvc} onCancel={() => setEditSvc(null)} />}
        </div>
      )}

      {/* ── MCP tab ── */}
      {tab === "mcp" && (
        <div className="ai-settings-body">
          <div className="ai-svc-list">
            {mcpServers.map(s => (
              <div key={s.id} className="ai-svc-item">
                <div className="ai-svc-item-info">
                  <div className="ai-svc-item-name">{s.name}</div>
                  <div className="ai-svc-item-meta">{s.url}</div>
                </div>
                <label style={{ fontSize: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={s.enabled} onChange={e => setMcpServers(arr => arr.map(x => x.id === s.id ? { ...x, enabled: e.target.checked } : x))} /> 启用
                </label>
                <button onClick={() => setEditingMcp(s)}>编辑</button>
                <button onClick={() => setMcpServers(arr => arr.filter(x => x.id !== s.id))}>删除</button>
              </div>
            ))}
          </div>
          <div className="ai-svc-add-row">
            <button onClick={() => setEditingMcp({ id: uid(), name: "新MCP服务", url: "http://localhost:3000", enabled: true })}>+ 添加 MCP 服务</button>
          </div>
          {editingMcp && (
            <McpEditor server={editingMcp} onChange={setEditingMcp}
              onSave={() => { setMcpServers(arr => { const i = arr.findIndex(x => x.id === editingMcp.id); return i >= 0 ? arr.map((x, j) => j === i ? editingMcp : x) : [...arr, editingMcp]; }); setEditingMcp(null); }}
              onCancel={() => setEditingMcp(null)} />
          )}
        </div>
      )}

      {/* ── 角色 tab ── */}
      {tab === "skill" && (
        <div className="ai-settings-body">
          <div className="ai-svc-list">
            {agentModes.map(a => (
              <div key={a.id} className={`ai-svc-item ${activeAgentId === a.id ? "on" : ""}`}>
                <div className="ai-svc-item-info" onClick={() => { setActiveAgentId(a.id === activeAgentId ? "" : a.id); setTab("chat"); }}>
                  <div className="ai-svc-item-name">{a.icon} {a.name}</div>
                  <div className="ai-svc-item-meta">{a.content?.slice(0, 60)}…</div>
                </div>
                <button onClick={() => setEditingAgent(a)}>编辑</button>
                <button onClick={() => { setAgentModes(arr => arr.filter(x => x.id !== a.id)); if (activeAgentId === a.id) setActiveAgentId(""); }}>删除</button>
              </div>
            ))}
          </div>
          <div className="ai-svc-add-row">
            <button onClick={() => setEditingAgent({ id: uid(), name: "新角色", icon: "✨", promptMode: "override", content: "" })}>+ 新建角色</button>
          </div>
          {editingAgent && (
            <AgentEditor agent={editingAgent} onChange={setEditingAgent}
              onSave={() => { setAgentModes(arr => { const i = arr.findIndex(x => x.id === editingAgent.id); return i >= 0 ? arr.map((x, j) => j === i ? editingAgent : x) : [...arr, editingAgent]; }); setEditingAgent(null); }}
              onCancel={() => setEditingAgent(null)} />
          )}
        </div>
      )}

      <NetworkPanel tool="ai" />
    </div>
  );
}

function SvcEditor({ svc, onChange, onSave, onCancel }: { svc: Service; onChange: (s: Service) => void; onSave: (s: Service) => void; onCancel: () => void; }) {
  const f = (k: keyof Service, v: string) => onChange({ ...svc, [k]: v });
  return (
    <div className="ai-editor">
      <div className="ai-editor-title">{svc.name || "新建服务"}</div>
      <div className="ai-editor-row"><label>名称</label><input value={svc.name} onChange={e => f("name", e.target.value)} /></div>
      <div className="ai-editor-row"><label>协议</label>
        <select value={svc.protocol} onChange={e => onChange({ ...svc, protocol: e.target.value as Protocol, ...DEFAULTS[e.target.value as Protocol] } as Service)}>
          <option value="openai">OpenAI 格式</option><option value="claude">Claude 格式</option>
        </select>
      </div>
      <div className="ai-editor-row"><label>Base URL</label><input value={svc.baseUrl} onChange={e => f("baseUrl", e.target.value)} /></div>
      <div className="ai-editor-row"><label>API Key</label><input type="password" value={svc.apiKey} onChange={e => f("apiKey", e.target.value)} /></div>
      <div className="ai-editor-row"><label>Model</label><input value={svc.model} onChange={e => f("model", e.target.value)} /></div>
      <div className="ai-editor-row"><label>System Prompt</label><textarea rows={3} value={svc.systemPrompt ?? ""} onChange={e => f("systemPrompt", e.target.value)} /></div>
      <div className="ai-editor-row"><label>Temperature</label><input type="number" min="0" max="2" step="0.1" value={svc.temperature ?? ""} onChange={e => onChange({ ...svc, temperature: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="默认" /></div>
      <div className="ai-editor-row"><label>Max Tokens</label><input type="number" min="1" value={svc.maxTokens ?? ""} onChange={e => onChange({ ...svc, maxTokens: e.target.value ? parseInt(e.target.value) : undefined })} placeholder="默认" /></div>
      <div className="ai-editor-actions"><button className="ai-save" onClick={() => onSave(svc)} disabled={!svc.name || !svc.apiKey || !svc.model}>保存</button><button onClick={onCancel}>取消</button></div>
    </div>
  );
}

function McpEditor({ server, onChange, onSave, onCancel }: { server: MCPServer; onChange: (s: MCPServer) => void; onSave: () => void; onCancel: () => void; }) {
  return (
    <div className="ai-editor">
      <div className="ai-editor-title">{server.name || "新建 MCP"}</div>
      <div className="ai-editor-row"><label>名称</label><input value={server.name} onChange={e => onChange({ ...server, name: e.target.value })} /></div>
      <div className="ai-editor-row"><label>URL</label><input value={server.url} onChange={e => onChange({ ...server, url: e.target.value })} placeholder="http://localhost:3000" /></div>
      <div className="ai-editor-actions"><button className="ai-save" onClick={onSave}>保存</button><button onClick={onCancel}>取消</button></div>
    </div>
  );
}

function AgentEditor({ agent, onChange, onSave, onCancel }: { agent: AgentMode; onChange: (a: AgentMode) => void; onSave: () => void; onCancel: () => void; }) {
  return (
    <div className="ai-editor">
      <div className="ai-editor-title">{agent.name || "新建角色"}</div>
      <div className="ai-editor-row"><label>图标</label><input value={agent.icon} onChange={e => onChange({ ...agent, icon: e.target.value })} /></div>
      <div className="ai-editor-row"><label>名称</label><input value={agent.name} onChange={e => onChange({ ...agent, name: e.target.value })} /></div>
      <div className="ai-editor-row"><label>Prompt 模式</label>
        <select value={agent.promptMode} onChange={e => onChange({ ...agent, promptMode: e.target.value as AgentMode["promptMode"] })}>
          <option value="override">覆盖系统 Prompt</option><option value="append">追加到系统 Prompt</option>
        </select>
      </div>
      <div className="ai-editor-row"><label>角色 Prompt</label><textarea rows={5} value={agent.content ?? ""} onChange={e => onChange({ ...agent, content: e.target.value })} /></div>
      <div className="ai-editor-actions"><button className="ai-save" onClick={onSave}>保存</button><button onClick={onCancel}>取消</button></div>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const html = renderMd(content);
  useEffect(() => {
    ref.current?.querySelectorAll("pre.ai-code-block").forEach(pre => {
      if (pre.querySelector(".ai-copy-btn")) return;
      const btn = document.createElement("button");
      btn.className = "ai-copy-btn"; btn.textContent = "复制";
      btn.addEventListener("click", () => copyText(pre.querySelector("code")?.textContent ?? ""));
      pre.appendChild(btn);
    });
  });
  return <div ref={ref} className="ai-md" dangerouslySetInnerHTML={{ __html: html }} />;
}
