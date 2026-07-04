import { useState, useRef, useEffect, useMemo } from "react";
import { flushSync } from "react-dom";
import { Marked, Renderer } from "marked";
import hljs from "highlight.js";
import DOMPurify from "dompurify";
import "highlight.js/styles/github-dark.css";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { LOCAL_TOOLS, bingSearch, baiduSearch, shenmaSearch } from "../agent/localTools";
import { loadMcpTools, getAllTools } from "../agent/toolRegistry";
import { runAgentLoop } from "../agent/agentLoop";
import { createSubagentTool, getAllSubagents } from "../agent/subagent";
import type { AgentTool, ServiceConfig } from "../agent/types";
import "./CarAssistant.css";

type Protocol = "openai" | "claude";
interface Service {
  id: string; name: string; protocol: Protocol;
  baseUrl: string; apiKey: string; model: string;
  systemPrompt?: string; temperature?: number; maxTokens?: number;
}
interface SearchConfig {
  enabled: boolean;
  provider: "bing" | "baidu" | "baidu-api" | "shenma" | "shenma-api" | "serpapi" | "custom" | "tavily" | "brave";
  apiKey: string;
  endpoint: string;
}
interface ToolStep { name: string; args: unknown; result?: string; source?: "local" | "mcp" | "subagent"; pending?: boolean; }
interface Message { role: "user" | "assistant"; content: string; images?: ImageResult[]; toolSteps?: ToolStep[]; }
interface SearchResult { title: string; snippet: string; url: string; }
interface ImageResult { url: string; alt: string; }
interface MCPServer { id: string; name: string; url: string; headers?: Record<string, string>; enabled: boolean; }
interface MCPTool { name: string; description: string; inputSchema: object; serverId: string; serverUrl: string; serverHeaders?: Record<string, string>; }
interface AgentMode {
  id: string; name: string; icon: string;
  type?: "prompt" | "markdown" | "script";
  content?: string;      // used for all types
  systemPrompt?: string; // legacy alias
  promptMode: "override" | "append";
  starterMessages?: string[];
}
const agentContent = (a: AgentMode) => a.content ?? a.systemPrompt ?? "";
const agentType = (a: AgentMode): "prompt" | "markdown" | "script" => a.type ?? "prompt";

const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_AGENT_MODES: AgentMode[] = [
  { id: "sk1", name: "选车顾问", icon: "🚗", type: "prompt", promptMode: "override",
    content: "你是专业选车顾问，根据用户预算、用途、偏好推荐最合适的车型，给出具体对比分析。",
    starterMessages: ["10-20万家用SUV推荐", "新能源还是燃油车？", "首购族适合什么车"] },
  { id: "sk2", name: "二手车鉴定", icon: "🔍", type: "prompt", promptMode: "override",
    content: "你是二手车鉴定专家，帮助用户识别风险、评估合理价格、指导验车流程。",
    starterMessages: ["二手车验车需要查哪些地方", "这辆车价格合理吗", "如何避免买到事故车"] },
  { id: "sk3", name: "保养专家", icon: "🔧", type: "prompt", promptMode: "override",
    content: "你是汽车保养专家，提供专业的保养周期、费用、注意事项和常见故障排查建议。",
    starterMessages: ["新车首保什么时候做", "保养项目和费用清单", "机油多久换一次"] },
  { id: "sk4", name: "保险计算", icon: "📋", type: "prompt", promptMode: "override",
    content: "你是汽车保险专家，帮助用户了解险种、计算费用、选择最划算的投保方案。",
    starterMessages: ["必须买哪些保险", "新手司机推荐什么险种", "怎么降低保险费用"] },
  { id: "sk5", name: "新能源对比", icon: "⚡", type: "prompt", promptMode: "override",
    content: "你是新能源汽车专家，深度对比纯电、插混、增程的优劣，结合实际使用场景给出建议。",
    starterMessages: ["纯电vs插混如何选", "充电桩不方便适合买电车吗", "增程式值得买吗"] },
];


// ── MCP tool helpers ────────────────────────────────────────────────────────
async function mcpJsonRpc(server: MCPServer, method: string, params?: unknown): Promise<unknown> {
  const resp = await tauriFetch(server.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(server.headers ?? {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? {} }),
  });
  const data = await resp.json() as { result?: unknown; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

async function fetchMcpTools(servers: MCPServer[]): Promise<MCPTool[]> {
  const tools: MCPTool[] = [];
  await Promise.allSettled(servers.filter(s => s.enabled).map(async (s) => {
    try {
      const result = await mcpJsonRpc(s, "tools/list") as { tools: Array<{ name: string; description: string; inputSchema: object }> };
      for (const t of result.tools ?? [])
        tools.push({ name: t.name, description: t.description, inputSchema: t.inputSchema, serverId: s.id, serverUrl: s.url, serverHeaders: s.headers });
    } catch { /* server unavailable */ }
  }));
  return tools;
}

async function callMcpTool(tool: MCPTool, args: unknown): Promise<string> {
  try {
    const result = await tauriFetch(tool.serverUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(tool.serverHeaders ?? {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool.name, arguments: args } }),
    });
    const data = await result.json() as { result?: { content?: Array<{ type: string; text?: string }> }; error?: { message: string } };
    if (data.error) return `Error: ${data.error.message}`;
    const parts = data.result?.content ?? [];
    return parts.map(p => p.text ?? "").join("\n") || "OK";
  } catch (e) { return `Error: ${(e as Error).message}`; }
}

const CAR_SYSTEM_PROMPT = `你是一位专业的汽车顾问，帮助用户看车、选车、买车和养车。

你可以使用以下工具来辅助回答：
- free_web_search：搜索互联网获取最新车辆信息、价格、评测
- free_image_search：搜索车辆图片
- web_fetch：读取网页详细内容
- calculate：数学计算（如保费、月供计算）
- delegate_to_subagent：委派任务给专业子代理（搜索研究员、二手车鉴定师、保险计算器）
- car_spec_dongchedi：从懂车帝获取车系完整参配数据
- car_spec_yiche：从易车网获取车系完整参配数据
- car_spec_pcauto：从太平洋汽车获取车系完整参配数据

工具调用规则（重要）：
- 问题涉及多个方面时，必须依次调用多个工具，不能只调用一个
- 凡是涉及"外观/图片/颜色/造型"→ 必须调用 free_image_search
- 凡是涉及"参数/配置/价格/评测/规格"→ 必须依次调用 car_spec_dongchedi、car_spec_yiche、car_spec_pcauto 三个工具，获取三网数据后汇总分析
- 同时涉及参配和外观 → 先调三个参配工具，再调 free_image_search
- 不要只调用一个工具就直接回答，确保每个问题维度都有对应的工具支撑

搜索词构造规则（重要）：
- 搜索汽车相关信息时，query 中必须包含"汽车"或"车型"以消歧，避免搜到品牌公司页面
- 年份规则：用户 query 中有年份（如"2024款"）则带上；用户没提年份，禁止自行拼接年份
- 正确示例（用户未提年份）："小米SU7汽车 评测 site:autohome.com.cn OR site:dongchedi.com"
- 正确示例（用户提了年份）："小米SU7 2024款汽车 评测 site:autohome.com.cn OR site:dongchedi.com"
- 搜索参数/配置/价格/评测时，query 末尾统一加 site:autohome.com.cn OR site:dongchedi.com 精准锁定汽车之家和懂车帝
- 搜价格时加"指导价 优惠"，搜评测时加"深度评测 用车体验"
- 保持query中车型车系的完整性

回答规范：
- 使用 Markdown 格式，层次清晰
- 车辆规格参数、价格对比、推荐卡片等结构化数据，用 HTML 包裹在 \`\`\`html 代码块中展示
- 图片直接通过12宫格/9宫格/6宫格/3宫格呈现给用户，不要展示文本超链接
- 可用的 HTML 组件样式类：
  - <div class="car-card">：卡片容器
  - <table class="cmp-table">：对比表格
  - <div class="price-tag">：价格标签
  - <div class="rating">：评分（用 ★ 和 ☆）
  - <details><summary>：可折叠区域
- 不要使用 <script> 或内联事件属性（onclick 等）
- 提供具体、客观、实用的建议；优先使用工具搜索获取最新数据`;

const QUICK_TOPICS = [
  "20万左右家用轿车推荐",
  "纯电动和插混如何选择",
  "买二手车要注意什么",
  "新车保养周期和费用",
  "汽车保险怎么买最划算",
];

const DEFAULTS: Record<Protocol, Partial<Service>> = {
  openai: { baseUrl: "https://api.openai.com", model: "gpt-4o" },
  claude: { baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-6" },
};

// isolated marked instance so it doesn't conflict with AiChat
const carRenderer = new Renderer();
carRenderer.code = function ({ text, lang }: { text: string; lang?: string }) {
  if (lang === "html") {
    return `<div class="ca-html-card">${DOMPurify.sanitize(text)}</div>`;
  }
  const highlighted = lang
    ? hljs.highlight(text, { language: lang, ignoreIllegals: true }).value
    : hljs.highlightAuto(text).value;
  return `<pre class="ca-code-block"><code>${highlighted}</code></pre>`;
};
const carMarked = new Marked({ renderer: carRenderer });

function renderMd(text: string): string {
  return DOMPurify.sanitize(carMarked.parse(text) as string);
}

async function streamSSE(
  url: string, init: RequestInit, protocol: Protocol,
  onChunk: (t: string) => void, onDone: () => void, onError: (e: string) => void,
  signal: AbortSignal,
) {
  try {
    const resp = await fetch(url, { ...init, signal });
    if (!resp.ok) { onError(`HTTP ${resp.status}: ${(await resp.text().catch(() => "")).slice(0, 200)}`); return; }
    const reader = resp.body?.getReader();
    if (!reader) { onError("无响应体"); return; }
    const dec = new TextDecoder();
    let buf = "";
    const finish = () => onDone();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") { finish(); return; }
        try {
          const json = JSON.parse(data);
          let text = "";
          if (protocol === "openai") {
            text = json.choices?.[0]?.delta?.content ?? "";
          } else {
            if (json.type === "content_block_delta" && json.delta?.type === "text_delta") text = json.delta.text ?? "";
            else if (json.type === "message_stop") { finish(); return; }
          }
          if (text) onChunk(text);
        } catch { /* skip */ }
      }
    }
    finish();
  } catch (e) {
    if ((e as Error).name !== "AbortError") onError((e as Error).message); else onDone();
  }
}

function buildReq(svc: Service, messages: Message[], tools?: MCPTool[], stream = true): [string, RequestInit] {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let url: string; let body: Record<string, unknown>;
  const apiMsgs = messages.map(m => ({ role: m.role, content: m.content }));
  if (svc.protocol === "claude") {
    url = `${svc.baseUrl.replace(/\/$/, "")}/v1/messages`;
    headers["x-api-key"] = svc.apiKey;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
    body = { model: svc.model, max_tokens: svc.maxTokens ?? 4096, stream, messages: apiMsgs };
    if (svc.systemPrompt?.trim()) body.system = svc.systemPrompt.trim();
    if (svc.temperature != null) body.temperature = svc.temperature;
    if (tools?.length) body.tools = tools.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
  } else {
    url = `${svc.baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
    headers["Authorization"] = `Bearer ${svc.apiKey}`;
    const allMsgs = svc.systemPrompt?.trim()
      ? [{ role: "system" as const, content: svc.systemPrompt.trim() }, ...apiMsgs]
      : apiMsgs;
    body = { model: svc.model, stream, messages: allMsgs };
    if (svc.maxTokens != null) body.max_tokens = svc.maxTokens;
    if (svc.temperature != null) body.temperature = svc.temperature;
    if (tools?.length) body.tools = tools.map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } }));
  }
  return [url, { method: "POST", headers, body: JSON.stringify(body) }];
}

// Non-streaming call for tool-use loop
async function callOnce(svc: Service, history: Message[], tools: MCPTool[]): Promise<{
  text: string;
  toolCalls: Array<{ id: string; name: string; args: unknown; tool: MCPTool }>;
}> {
  const [url, init] = buildReq(svc, history, tools, false);
  const resp = await tauriFetch(url, init as Parameters<typeof tauriFetch>[1]);
  const data = await resp.json() as Record<string, unknown>;
  const toolCalls: Array<{ id: string; name: string; args: unknown; tool: MCPTool }> = [];
  let text = "";

  if (svc.protocol === "claude") {
    const content = (data.content ?? []) as Array<{ type: string; id?: string; name?: string; input?: unknown; text?: string }>;
    for (const block of content) {
      if (block.type === "tool_use") {
        const t = tools.find(x => x.name === block.name);
        if (t) toolCalls.push({ id: block.id!, name: block.name!, args: block.input, tool: t });
      } else if (block.type === "text") {
        text += block.text ?? "";
      }
    }
  } else {
    const msg = (data as { choices?: Array<{ message?: { content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }> }).choices?.[0]?.message;
    text = msg?.content ?? "";
    for (const tc of msg?.tool_calls ?? []) {
      const t = tools.find(x => x.name === tc.function.name);
      if (t) toolCalls.push({ id: tc.id, name: tc.function.name, args: JSON.parse(tc.function.arguments || "{}"), tool: t });
    }
  }
  return { text, toolCalls };
}

async function doSearch(cfg: SearchConfig, query: string): Promise<{ results: SearchResult[]; images: ImageResult[] }> {
  try {
    if (cfg.provider === "tavily") {
      const resp = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: cfg.apiKey, query, max_results: 5 }),
      });
      const data = await resp.json() as { results?: Array<{ title: string; content: string; url: string }> };
      return { results: (data.results ?? []).slice(0, 5).map(v => ({ title: v.title, snippet: v.content, url: v.url })), images: [] };
    }
    if (cfg.provider === "brave") {
      const resp = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
        headers: { "X-Subscription-Token": cfg.apiKey, Accept: "application/json" },
      });
      const data = await resp.json() as { web?: { results?: Array<{ title: string; description: string; url: string }> } };
      return { results: (data.web?.results ?? []).slice(0, 5).map(v => ({ title: v.title, snippet: v.description, url: v.url })), images: [] };
    }
    if (cfg.provider === "bing") {
      const results = await bingSearch(query, 5);
      return { results, images: [] };
    }
    if (cfg.provider === "baidu") {
      return { results: await baiduSearch(query, 5), images: [] };
    }
    if (cfg.provider === "shenma") {
      return { results: await shenmaSearch(query, 5), images: [] };
    }
    if (cfg.provider === "baidu-api" || cfg.provider === "shenma-api") {
      const resp = await fetch(`${cfg.endpoint}?q=${encodeURIComponent(query)}&count=5`, {
        headers: { "Authorization": `Bearer ${cfg.apiKey}`, "X-API-Key": cfg.apiKey },
      });
      const data = await resp.json();
      const items: Record<string, string>[] = Array.isArray(data) ? data : (data.results ?? data.items ?? data.data ?? []);
      return { results: items.slice(0, 5).map(v => ({ title: v.title ?? v.name ?? "", snippet: v.snippet ?? v.description ?? v.abstract ?? "", url: v.url ?? v.link ?? "" })), images: [] };
    }
    if (cfg.provider === "serpapi") {
      const resp = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${cfg.apiKey}&engine=google&num=5`);
      const data = await resp.json();
      return { results: (data.organic_results ?? []).slice(0, 5).map((v: { title: string; snippet: string; link: string }) => ({ title: v.title, snippet: v.snippet, url: v.link })), images: [] };
    }
    const headers: Record<string, string> = {};
    if (cfg.apiKey) headers["Authorization"] = `Bearer ${cfg.apiKey}`;
    const resp = await fetch(`${cfg.endpoint}?q=${encodeURIComponent(query)}`, { headers });
    const data = await resp.json();
    const items: Record<string, string>[] = Array.isArray(data) ? data : (data.results ?? data.items ?? data.value ?? []);
    return { results: items.slice(0, 5).map(v => ({ title: v.title ?? v.name ?? "", snippet: v.snippet ?? v.description ?? v.body ?? "", url: v.url ?? v.link ?? "" })), images: [] };
  } catch { return { results: [], images: [] }; }
}

async function runAgentScript(
  script: string, query: string,
  searchCfg: SearchConfig, mcpServers: MCPServer[],
): Promise<string> {
  let output = "";
  const ctx = {
    query,
    async search(q: string): Promise<SearchResult[]> {
      const { results } = await doSearch(searchCfg, q);
      return results;
    },
    async mcpCall(serverUrl: string, toolName: string, args: unknown): Promise<string> {
      const s = mcpServers.find(x => x.url === serverUrl && x.enabled);
      if (!s) return "server not found";
      return callMcpTool(
        { name: toolName, description: "", inputSchema: {}, serverId: s.id, serverUrl: s.url, serverHeaders: s.headers },
        args,
      );
    },
    write(text: string) { output += text; },
  };
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function("ctx", `const {query,search,mcpCall,write}=ctx;return(async()=>{${script}})();`);
    const ret = await (fn(ctx) as Promise<unknown>);
    return (typeof ret === "string" ? ret : "") || output || "(无输出)";
  } catch (e) {
    return `❌ 脚本错误: ${(e as Error).message}`;
  }
}

function formatSearchContext(results: SearchResult[]): string {
  if (!results.length) return "";
  return "以下是网络搜索结果供参考：\n\n" +
    results.map((r, i) => `[${i + 1}] **${r.title}**\n${r.snippet}\n来源：${r.url}`).join("\n\n");
}

function ImageGrid({ images }: { images: ImageResult[] }) {
  if (!images.length) return null;
  return (
    <div className="ca-img-grid">
      {images.map((img, i) => (
        <img key={i} src={img.url} alt={img.alt} loading="lazy"
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
      ))}
    </div>
  );
}

function SkillEditor({ skill, onChange, onSave, onCancel }: {
  skill: AgentMode; onChange: (s: AgentMode) => void; onSave: () => void; onCancel: () => void;
}) {
  const t = agentType(skill);
  const c = agentContent(skill);
  const set = (patch: Partial<AgentMode>) => onChange({ ...skill, content: c, type: t, ...patch });
  const typeLabel = t === "script" ? "脚本 (JS)" : t === "markdown" ? "Markdown 文档" : "System Prompt";
  return (
    <div className="ca-svc-editor">
      <div className="ca-svc-row"><label>图标</label><input value={skill.icon} onChange={e => set({ icon: e.target.value })} style={{ width: 48 }} /></div>
      <div className="ca-svc-row"><label>名称</label><input value={skill.name} onChange={e => set({ name: e.target.value })} /></div>
      <div className="ca-svc-row">
        <label>类型</label>
        <select value={t} onChange={e => set({ type: e.target.value as AgentMode["type"] })}>
          <option value="prompt">Prompt</option>
          <option value="markdown">Markdown</option>
          <option value="script">Script</option>
        </select>
      </div>
      {t !== "script" && (
        <div className="ca-svc-row">
          <label>Prompt模式</label>
          <select value={skill.promptMode} onChange={e => set({ promptMode: e.target.value as AgentMode["promptMode"] })}>
            <option value="override">覆盖</option>
            <option value="append">追加</option>
          </select>
        </div>
      )}
      <div className="ca-svc-row ca-svc-row-col">
        <label>{typeLabel}</label>
        <textarea rows={t === "script" ? 12 : 6} value={c}
          onChange={e => set({ content: e.target.value })}
          style={t === "script" ? { fontFamily: "monospace", fontSize: 12 } : undefined} />
      </div>
      {t === "script" && (
        <p className="ca-search-hint">可用: <code>query</code>（用户输入）, <code>await search(q)</code>, <code>await mcpCall(url, tool, args)</code>, <code>write(text)</code>；return 字符串作为最终回复</p>
      )}
      <div className="ca-svc-btns"><button onClick={onSave}>保存</button><button onClick={onCancel}>取消</button></div>
    </div>
  );
}

function McpEditor({ server, onChange, onSave, onCancel }: {
  server: MCPServer; onChange: (s: MCPServer) => void; onSave: () => void; onCancel: () => void;
}) {
  const headersStr = JSON.stringify(server.headers ?? {}, null, 2);
  return (
    <div className="ca-svc-editor">
      <div className="ca-svc-row"><label>名称</label><input value={server.name} onChange={e => onChange({ ...server, name: e.target.value })} /></div>
      <div className="ca-svc-row"><label>URL</label><input value={server.url} onChange={e => onChange({ ...server, url: e.target.value })} placeholder="http://localhost:3000" /></div>
      <div className="ca-svc-row ca-svc-row-col">
        <label>Headers (JSON)</label>
        <textarea rows={3} defaultValue={headersStr}
          onChange={e => { try { onChange({ ...server, headers: JSON.parse(e.target.value) }); } catch { /* ignore */ } }} />
      </div>
      <div className="ca-svc-btns"><button onClick={onSave}>保存</button><button onClick={onCancel}>取消</button></div>
    </div>
  );
}

function newSvc(protocol: Protocol): Service {
  return { id: uid(), name: "新服务", protocol, baseUrl: DEFAULTS[protocol].baseUrl!, apiKey: "", model: DEFAULTS[protocol].model!, systemPrompt: CAR_SYSTEM_PROMPT };
}

function TypingIndicator() {
  return (
    <div className="ca-row ca-row-ai">
      <div className="ca-avatar ca-avatar-ai">🚗</div>
      <div className="ca-msg ca-msg-ai"><div className="ca-typing"><span /><span /><span /></div></div>
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  free_web_search: "🔍 搜索网页",
  free_image_search: "🖼️ 搜索图片",
  web_fetch: "📄 读取网页",
  calculate: "🧮 计算",
  delegate_to_subagent: "🤖 调用子代理",
  car_spec_dongchedi: "🚗 懂车帝参配",
  car_spec_yiche: "🚗 易车参配",
  car_spec_pcauto: "🚗 太平洋汽车参配",
};
function toolLabel(name: string, args: unknown): string {
  const base = TOOL_LABELS[name] ?? `🔧 ${name}`;
  const q = (args as Record<string, string>)?.query ?? (args as Record<string, string>)?.url;
  return q ? `${base}：${String(q).slice(0, 40)}` : base;
}

function CarMsgView({ msg }: { msg: Message }) {
  const html = useMemo(() => msg.role === "assistant" ? renderMd(msg.content) : undefined, [msg.content]);
  if (msg.role === "user") {
    return (
      <div className="ca-row ca-row-user">
        <div className="ca-msg ca-msg-user">{msg.content}</div>
        <div className="ca-avatar ca-avatar-user">You</div>
      </div>
    );
  }
  const pending = msg.toolSteps?.filter(s => s.pending) ?? [];
  const done = msg.toolSteps?.filter(s => !s.pending) ?? [];
  return (
    <div className="ca-row ca-row-ai">
      <div className="ca-avatar ca-avatar-ai">🚗</div>
      <div className="ca-msg ca-msg-ai">
        {(pending.length > 0 || done.length > 0) && (
          <div className="ca-tool-steps">
            {/* 进行中：展开显示 */}
            {pending.map((s, i) => (
              <div key={`p${i}`} className={`ca-tool-thinking ca-tool-${s.source || "local"}`}>
                <span className="ca-tool-thinking-dot" />
                <span className="ca-tool-thinking-label">{toolLabel(s.name, s.args)}</span>
              </div>
            ))}
            {/* 已完成：折叠 */}
            {done.map((s, i) => (
              <details key={`d${i}`} className={`ca-tool-step ca-tool-${s.source || "local"}`}>
                <summary>
                  <span className="ca-tool-icon">✓</span>
                  <span className="ca-tool-name">{toolLabel(s.name, s.args)}</span>
                  {s.result && <span className="ca-tool-result-preview">{s.result.slice(0, 80)}{s.result.length > 80 ? "…" : ""}</span>}
                </summary>
                {s.result && <div className="ca-tool-result">{s.result}</div>}
              </details>
            ))}
          </div>
        )}
        {msg.images?.length ? <ImageGrid images={msg.images} /> : null}
        <div className="ca-md" dangerouslySetInnerHTML={{ __html: html ?? "" }} />
      </div>
    </div>
  );
}

function SvcEditor({ svc, onChange, onSave, onCancel }: {
  svc: Service; onChange: (s: Service) => void; onSave: () => void; onCancel: () => void;
}) {
  const f = (k: keyof Service, v: string | number) => onChange({ ...svc, [k]: v });
  return (
    <div className="ca-svc-editor">
      <div className="ca-svc-row"><label>名称</label><input value={svc.name} onChange={e => f("name", e.target.value)} /></div>
      <div className="ca-svc-row">
        <label>协议</label>
        <select value={svc.protocol} onChange={e => onChange({ ...svc, protocol: e.target.value as Protocol, ...DEFAULTS[e.target.value as Protocol] })}>
          <option value="openai">OpenAI</option>
          <option value="claude">Claude</option>
        </select>
      </div>
      <div className="ca-svc-row"><label>Base URL</label><input value={svc.baseUrl} onChange={e => f("baseUrl", e.target.value)} /></div>
      <div className="ca-svc-row"><label>API Key</label><input type="password" value={svc.apiKey} onChange={e => f("apiKey", e.target.value)} /></div>
      <div className="ca-svc-row"><label>Model</label><input value={svc.model} onChange={e => f("model", e.target.value)} /></div>
      <div className="ca-svc-row"><label>Temperature</label><input type="number" min="0" max="2" step="0.1" value={svc.temperature ?? ""} onChange={e => f("temperature", parseFloat(e.target.value))} placeholder="默认" /></div>
      <div className="ca-svc-row"><label>Max Tokens</label><input type="number" min="1" value={svc.maxTokens ?? ""} onChange={e => f("maxTokens", parseInt(e.target.value))} placeholder="默认" /></div>
      <div className="ca-svc-row ca-svc-row-col"><label>System Prompt</label><textarea rows={5} value={svc.systemPrompt ?? ""} onChange={e => f("systemPrompt", e.target.value)} /></div>
      <div className="ca-svc-btns"><button onClick={onSave}>保存</button><button onClick={onCancel}>取消</button></div>
    </div>
  );
}

// legacy functions kept for reference; replaced by agent modules
void fetchMcpTools; void streamSSE; void callOnce; void formatSearchContext;

export default function CarAssistant({ instanceId }: ToolProps) {
  const ns = `car:${instanceId}`;
  const [svcs, setSvcs] = usePersistentState<Service[]>(`${ns}:svcs`, []);
  const [svcId, setSvcId] = usePersistentState<string>(`${ns}:svc`, "");
  const [searchCfg, setSearchCfg] = usePersistentState<SearchConfig>(`${ns}:search`, { enabled: false, provider: "bing", apiKey: "", endpoint: "" });
  const [mcpServers, setMcpServers] = usePersistentState<MCPServer[]>(`${ns}:mcp`, []);
  const [agentModes, setAgentModes] = usePersistentState<AgentMode[]>(`${ns}:skills`, DEFAULT_AGENT_MODES);
  const [activeAgentId, setActiveAgentId] = usePersistentState<string>(`${ns}:skillId`, "");
  const [tab, setTab] = useState<"chat" | "svc" | "search" | "mcp" | "skill">("chat");
  const [editingSvc, setEditingSvc] = useState<Service | null>(null);
  const [editingMcp, setEditingMcp] = useState<MCPServer | null>(null);
  const [editingAgent, setEditingAgent] = useState<AgentMode | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const svc = useMemo(() => svcs.find(s => s.id === svcId) ?? null, [svcs, svcId]);
  const activeAgent = useMemo(() => agentModes.find(s => s.id === activeAgentId) ?? null, [agentModes, activeAgentId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function effectiveSvc(): Service | null {
    if (!svc) return null;
    if (!activeAgent || agentType(activeAgent) === "script") return svc;
    const c = agentContent(activeAgent);
    const sp = activeAgent.promptMode === "override"
      ? c
      : [svc.systemPrompt ?? "", c].filter(Boolean).join("\n\n");
    return { ...svc, systemPrompt: sp };
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    setInput("");

    // Script agent: execute directly, skip LLM
    if (activeAgent && agentType(activeAgent) === "script" && agentContent(activeAgent)) {
      const userMsg: Message = { role: "user", content };
      setMessages(prev => [...prev, userMsg, { role: "assistant", content: "" }]);
      setStreaming(true);
      const result = await runAgentScript(agentContent(activeAgent), content, searchCfg, mcpServers);
      setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: result }]);
      setStreaming(false);
      return;
    }

    const esvc = effectiveSvc();
    if (!esvc) return;

    const userMsg: Message = { role: "user", content };
    setMessages(prev => [...prev, userMsg]);
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // 收集所有工具：本地工具 + MCP 工具 + 子代理工具
    const mcpAgentTools = await loadMcpTools(mcpServers);
    const subagents = getAllSubagents();
    const subagentTool = createSubagentTool(subagents, esvc as ServiceConfig, getAllTools(mcpAgentTools));
    const allTools: AgentTool[] = [...LOCAL_TOOLS, ...mcpAgentTools, subagentTool];

    // 消息历史
    const history = [...messages.map(m => ({ role: m.role, content: m.content })), { role: "user" as const, content }];

    // 运行 Agent 循环
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
          onToolEnd: (name: string, result: string, source: "local" | "mcp") => {
            const step = toolSteps.find(s => s.name === name && s.pending);
            if (step) { step.result = result; step.pending = false; step.source = source; }
            flushSync(() => {
              setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: reply, toolSteps: [...toolSteps] }]);
            });
          },
          onImages: (images: { url: string; alt: string }[]) => {
            flushSync(() => {
              setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: reply, toolSteps: [...toolSteps], images }]);
            });
          },
        },
        maxRounds: 15,
        signal: ctrl.signal,
      });

      // 最终更新消息
      setMessages(prev => [...prev.slice(0, -1), {
        role: "assistant",
        content: result.text || reply,
        toolSteps: result.toolSteps as ToolStep[],
      }]);
    } catch (e) {
      setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: `❌ ${(e as Error).message}` }]);
    } finally {
      setStreaming(false);
    }
  }

  function saveEditingSvc() {
    if (!editingSvc) return;
    const exists = svcs.find(s => s.id === editingSvc.id);
    if (exists) setSvcs(svcs.map(s => s.id === editingSvc.id ? editingSvc : s));
    else { setSvcs([...svcs, editingSvc]); setSvcId(editingSvc.id); }
    setEditingSvc(null);
  }
  function saveEditingMcp() {
    if (!editingMcp) return;
    const exists = mcpServers.find(s => s.id === editingMcp.id);
    if (exists) setMcpServers(mcpServers.map(s => s.id === editingMcp.id ? editingMcp : s));
    else setMcpServers([...mcpServers, editingMcp]);
    setEditingMcp(null);
  }
  function saveEditingAgent() {
    if (!editingAgent) return;
    const exists = agentModes.find(s => s.id === editingAgent.id);
    if (exists) setAgentModes(agentModes.map(s => s.id === editingAgent.id ? editingAgent : s));
    else setAgentModes([...agentModes, editingAgent]);
    setEditingAgent(null);
  }

  const quickTopics = activeAgent?.starterMessages ?? QUICK_TOPICS;

  return (
    <div className="ca-root">
      <div className="ca-header">
        <span className="ca-title">汽车助手</span>
        <div className="ca-tabs">
          {(["chat","svc","search","mcp","skill"] as const).map(t => (
            <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {t === "chat" ? "对话" : t === "svc" ? "大模型" : t === "search" ? "搜索" : t === "mcp" ? "MCP" : "角色"}
            </button>
          ))}
        </div>
        {tab === "chat" && <button className="ca-clear" onClick={() => setMessages([])}>清空</button>}
      </div>

      {tab === "svc" && (
        <div className="ca-config-panel">
          {editingSvc ? (
            <SvcEditor svc={editingSvc} onChange={setEditingSvc} onSave={saveEditingSvc} onCancel={() => setEditingSvc(null)} />
          ) : (
            <>
              <div className="ca-svc-list">
                {svcs.map(s => (
                  <div key={s.id} className={`ca-svc-item ${s.id === svcId ? "on" : ""}`}>
                    <span onClick={() => setSvcId(s.id)}>{s.name} <small>({s.protocol})</small></span>
                    <button onClick={() => setEditingSvc({ ...s })}>编辑</button>
                    <button onClick={() => { setSvcs(svcs.filter(x => x.id !== s.id)); if (svcId === s.id) setSvcId(""); }}>删除</button>
                  </div>
                ))}
              </div>
              <div className="ca-svc-add-row">
                <button onClick={() => setEditingSvc(newSvc("openai"))}>+ OpenAI</button>
                <button onClick={() => setEditingSvc(newSvc("claude"))}>+ Claude</button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "search" && (
        <div className="ca-config-panel">
          <label className="ca-search-toggle">
            <input type="checkbox" checked={searchCfg.enabled} onChange={e => setSearchCfg({ ...searchCfg, enabled: e.target.checked })} />
            启用搜索增强
          </label>
          <div className="ca-svc-row">
            <label>提供商</label>
            <select value={searchCfg.provider} onChange={e => setSearchCfg({ ...searchCfg, provider: e.target.value as SearchConfig["provider"] })}>
              <optgroup label="免费（无需 API Key）">
                <option value="bing">Bing 搜索（免费）</option>
                <option value="baidu">百度搜索（免费）</option>
                <option value="shenma">神马搜索-阿里（免费）</option>
              </optgroup>
              <optgroup label="API 接入（需要 Key）">
                <option value="baidu-api">百度搜索 API</option>
                <option value="shenma-api">神马搜索 API（阿里）</option>
                <option value="tavily">Tavily Search</option>
                <option value="brave">Brave Search</option>
                <option value="serpapi">SerpAPI (Google)</option>
                <option value="custom">自定义</option>
              </optgroup>
            </select>
          </div>
          {!["bing", "baidu", "shenma"].includes(searchCfg.provider) && (
            <div className="ca-svc-row"><label>API Key</label><input type="password" value={searchCfg.apiKey} onChange={e => setSearchCfg({ ...searchCfg, apiKey: e.target.value })} /></div>
          )}
          {["baidu-api", "shenma-api", "custom"].includes(searchCfg.provider) && (
            <div className="ca-svc-row"><label>Endpoint</label><input value={searchCfg.endpoint} onChange={e => setSearchCfg({ ...searchCfg, endpoint: e.target.value })} placeholder="https://..." /></div>
          )}
          <p className="ca-search-hint">
            {searchCfg.provider === "bing" && "通过 Bing.com 抓取，无需 API Key"}
            {searchCfg.provider === "baidu" && "通过百度搜索抓取，无需 API Key"}
            {searchCfg.provider === "shenma" && "通过神马搜索（阿里）抓取，无需 API Key"}
            {searchCfg.provider === "baidu-api" && "百度搜索开放平台 API，填入 API Key 和接口地址"}
            {searchCfg.provider === "shenma-api" && "神马搜索（阿里）开放 API，填入 API Key 和接口地址"}
            {searchCfg.provider === "tavily" && "Tavily Search API — 专为 AI 优化，申请：tavily.com"}
            {searchCfg.provider === "brave" && "Brave Search API — 独立索引，申请：brave.com/search/api"}
            {searchCfg.provider === "serpapi" && "需要 SerpAPI 账号密钥（serpapi.com）"}
            {searchCfg.provider === "custom" && "自定义端点，响应需包含 title/snippet/url 字段"}
          </p>
        </div>
      )}

      {tab === "mcp" && (
        <div className="ca-config-panel">
          {editingMcp ? (
            <McpEditor server={editingMcp} onChange={setEditingMcp} onSave={saveEditingMcp} onCancel={() => setEditingMcp(null)} />
          ) : (
            <>
              <div className="ca-svc-list">
                {mcpServers.map(s => (
                  <div key={s.id} className="ca-mcp-item">
                    <div className={`ca-mcp-status ${s.enabled ? "on" : ""}`} />
                    <span style={{ flex: 1 }}>{s.name} <small>{s.url}</small></span>
                    <input type="checkbox" checked={s.enabled} onChange={e => setMcpServers(mcpServers.map(x => x.id === s.id ? { ...x, enabled: e.target.checked } : x))} />
                    <button onClick={() => setEditingMcp({ ...s })}>编辑</button>
                    <button onClick={() => setMcpServers(mcpServers.filter(x => x.id !== s.id))}>删除</button>
                  </div>
                ))}
              </div>
              <div className="ca-svc-add-row">
                <button onClick={() => setEditingMcp({ id: uid(), name: "新 MCP 服务", url: "", enabled: true })}>+ 添加 MCP Server</button>
              </div>
              <p className="ca-search-hint">MCP Server 需支持 JSON-RPC 2.0 over HTTP（Streamable HTTP transport）</p>
            </>
          )}
        </div>
      )}

      {tab === "skill" && (
        <div className="ca-config-panel">
          {editingAgent ? (
            <SkillEditor skill={editingAgent} onChange={setEditingAgent} onSave={saveEditingAgent} onCancel={() => setEditingAgent(null)} />
          ) : (
            <>
              <div className="ca-skill-chips">
                {agentModes.map(s => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button className={`ca-skill-chip ${activeAgentId === s.id ? "on" : ""}`}
                      onClick={() => setActiveAgentId(activeAgentId === s.id ? "" : s.id)}>
                      {s.icon} {s.name}
                    </button>
                    <button onClick={() => setEditingAgent({ ...s })} style={{ fontSize: 11, padding: "2px 6px" }}>编辑</button>
                    {!DEFAULT_AGENT_MODES.find(d => d.id === s.id) && (
                      <button onClick={() => { setAgentModes(agentModes.filter(x => x.id !== s.id)); if (activeAgentId === s.id) setActiveAgentId(""); }} style={{ fontSize: 11, padding: "2px 6px" }}>删除</button>
                    )}
                  </div>
                ))}
              </div>
              <div className="ca-svc-add-row">
                <button onClick={() => setEditingAgent({ id: uid(), name: "新角色", icon: "✨", systemPrompt: "", promptMode: "override" })}>+ 新建角色</button>
              </div>
              <p className="ca-search-hint">点击角色卡片激活（高亮），激活后会覆盖或追加当前对话的 System Prompt</p>
            </>
          )}
        </div>
      )}

      {tab === "chat" && (
        <>
          {!svc && <div className="ca-no-svc">请先在「大模型」标签页配置服务 <button onClick={() => setTab("svc")}>去配置</button></div>}
          {activeAgent && (
            <div className="ca-skill-bar">
              <span>{activeAgent.icon} 角色：{activeAgent.name}</span>
              <button style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => setActiveAgentId("")}>取消</button>
            </div>
          )}
          <div className="ca-messages">
            {messages.length === 0 && (
              <div className="ca-welcome">
                <div className="ca-welcome-icon">🚗</div>
                <div className="ca-welcome-text">有什么汽车问题想了解？</div>
                <div className="ca-topics">
                  {quickTopics.map(t => <button key={t} className="ca-topic-chip" onClick={() => send(t)}>{t}</button>)}
                </div>
              </div>
            )}
            {messages.map((m, i) => {
              if (streaming && i === messages.length - 1 && m.role === "assistant" && !m.content)
                return <TypingIndicator key={i} />;
              return <CarMsgView key={i} msg={m} />;
            })}
            <div ref={bottomRef} />
          </div>
          <div className="ca-input-area">
            <textarea className="ca-input" value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="询问任何汽车问题…（Enter 发送，Shift+Enter 换行）"
              rows={3} disabled={streaming || !svc} />
            <div className="ca-input-btns">
              {streaming
                ? <button onClick={() => abortRef.current?.abort()}>停止</button>
                : <button onClick={() => send()} disabled={!svc || !input.trim()}>发送</button>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
