import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText } from "../useCopyFeedback";
import { dispatchCompose } from "./proxyCompose";
import "./HttpProxy.css";

// ── types ─────────────────────────────────────────────────────────────────────

type DnsSpoofRule    = { type: "DnsSpoof";    enabled: boolean; host: string; ip: string };
type MapRemoteRule   = { type: "MapRemote";   enabled: boolean; matchHost: string; matchPath: string; targetUrl: string };
type PathRewriteRule = { type: "PathRewrite"; enabled: boolean; matchHost: string; matchPrefix: string; replacement: string };
type ParamKV         = { key: string; value: string };
type ParamInjectRule = { type: "ParamInject"; enabled: boolean; matchHost: string; matchPath: string; params: ParamKV[] };
type MapLocalRule    = { type: "MapLocal";    enabled: boolean; matchHost: string; matchPath: string; filePath: string; status: number; contentType: string };
type BlockListRule   = { type: "BlockList";   enabled: boolean; matchHost: string; matchPath: string; status: number };
type RewriteRule     = { type: "Rewrite";     enabled: boolean; matchHost: string; matchPath: string; target: string; pattern: string; replacement: string };
type ProxyRule       = DnsSpoofRule | MapRemoteRule | PathRewriteRule | ParamInjectRule | MapLocalRule | BlockListRule | RewriteRule;

interface BreakpointRule {
  matchHost: string;
  matchPath: string;
  phase: "request" | "response";
}

interface ProxyConfig {
  rules: ProxyRule[];
  noCaching: boolean;
  breakpoints: BreakpointRule[];
  throttle: { enabled: boolean; bandwidth: number; latency: number };
  httpsDecrypt: boolean;
}

interface TrafficEntry {
  id: string;
  method: string;
  url: string;
  original_url: string;
  peer_addr: string;
  status?: number;
  duration?: number;
  error?: string;
  timestamp: number;
  rule_matched: boolean;
  req_headers: [string, string][];
  req_body_preview: string;
  res_headers: [string, string][];
  res_body_preview: string;
  res_body_size: number;
}

interface BreakpointHit {
  id: string;
  phase: string;
  method: string;
  url: string;
  headers: [string, string][];
  body: string;
  status?: number;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function newDnsSpoof(): DnsSpoofRule { return { type: "DnsSpoof", enabled: true, host: "", ip: "" }; }
function newMapRemote(): MapRemoteRule { return { type: "MapRemote", enabled: true, matchHost: "", matchPath: "/", targetUrl: "" }; }
function newPathRewrite(): PathRewriteRule { return { type: "PathRewrite", enabled: true, matchHost: "", matchPrefix: "/", replacement: "/" }; }
function newParamInject(): ParamInjectRule { return { type: "ParamInject", enabled: true, matchHost: "", matchPath: "/", params: [] }; }
function newMapLocal(): MapLocalRule { return { type: "MapLocal", enabled: true, matchHost: "", matchPath: "/", filePath: "", status: 200, contentType: "" }; }
function newBlockList(): BlockListRule { return { type: "BlockList", enabled: true, matchHost: "", matchPath: "/", status: 404 }; }
function newRewrite(): RewriteRule { return { type: "Rewrite", enabled: true, matchHost: "", matchPath: "/", target: "res_body", pattern: "", replacement: "" }; }

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtTs(ts: number): string {
  return new Date(ts).toLocaleTimeString("zh-CN", { hour12: false });
}

function statusClass(s?: number): string {
  if (s == null) return "hproxy-status-pending";
  if (s >= 200 && s < 400) return "hproxy-status-ok";
  return "hproxy-status-err";
}

/** JSON body 美化 */
function prettyBody(text: string): string {
  if (!text) return "";
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}

/** 导出 HAR */
/** Repeat: 用 fetch 重发请求 */
async function repeatRequest(entry: TrafficEntry) {
  try {
    const headers: Record<string, string> = {};
    for (const [k, v] of entry.req_headers) {
      const lk = k.toLowerCase();
      if (lk === "host" || lk === "connection" || lk === "proxy-connection" || lk === "content-length" || lk === "accept-encoding") continue;
      headers[k] = v;
    }
    const r = await fetch(entry.original_url, {
      method: entry.method,
      headers,
      body: entry.req_body_preview || undefined,
    });
    const text = await r.text();
    copyText(text, `重放完成: ${r.status} ${r.statusText} (${text.length} bytes)`);
  } catch (e) {
    copyText("", `重放失败: ${(e as Error).message}`);
  }
}

/** Mirror: 保存流量到磁盘文件 */
function mirrorEntry(entry: TrafficEntry) {
  const data = {
    method: entry.method,
    url: entry.original_url,
    timestamp: new Date(entry.timestamp).toISOString(),
    request: { headers: Object.fromEntries(entry.req_headers), body: entry.req_body_preview },
    response: { status: entry.status, headers: Object.fromEntries(entry.res_headers), body: entry.res_body_preview },
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  const safeName = entry.url.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 60);
  a.href = URL.createObjectURL(blob);
  a.download = `mirror_${safeName}_${entry.timestamp}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  copyText("", "流量已镜像保存");
}

function exportHar(traffic: TrafficEntry[]) {
  const har = {
    log: {
      version: "1.2",
      creator: { name: "DeskTool HTTP Proxy", version: "1.0" },
      entries: traffic.map((e) => ({
        startedDateTime: new Date(e.timestamp).toISOString(),
        time: e.duration ?? 0,
        request: {
          method: e.method,
          url: e.original_url,
          httpVersion: "HTTP/1.1",
          headers: e.req_headers.map(([k, v]) => ({ name: k, value: v })),
          queryString: [],
          headersSize: -1,
          bodySize: e.req_body_preview?.length ?? 0,
          postData: e.req_body_preview ? { mimeType: "application/json", text: e.req_body_preview } : undefined,
        },
        response: {
          status: e.status ?? 0,
          statusText: "",
          httpVersion: "HTTP/1.1",
          headers: e.res_headers.map(([k, v]) => ({ name: k, value: v })),
          content: {
            size: e.res_body_size,
            mimeType: e.res_headers.find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? "text/html",
            text: e.res_body_preview,
          },
          headersSize: -1,
          bodySize: e.res_body_size,
          redirectURL: "",
        },
        cache: {},
        timings: { send: 0, wait: e.duration ?? 0, receive: 0 },
      })),
    },
  };
  const blob = new Blob([JSON.stringify(har, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `proxy-${new Date().toISOString().slice(0, 10)}.har`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** 把请求转为 curl 命令 */
function toCurl(entry: TrafficEntry): string {
  const parts = [`curl -X ${entry.method} '${entry.url}'`];
  for (const [k, v] of entry.req_headers) {
    const lk = k.toLowerCase();
    if (lk === "host" || lk === "connection" || lk === "proxy-connection" || lk === "content-length" || lk === "accept-encoding") continue;
    parts.push(`  -H '${k}: ${v}'`);
  }
  if (entry.req_body_preview.trim()) {
    parts.push(`  -d '${entry.req_body_preview.replace(/'/g, "'\\''")}'`);
  }
  parts.push("  --compressed");
  return parts.join(" \\\n");
}

// ── collapsible section ───────────────────────────────────────────────────────

function Section({
  title, desc, children, onAdd, addLabel = "+ 添加",
}: {
  title: string; desc: string; children: React.ReactNode; onAdd: () => void; addLabel?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="hproxy-section">
      <div className="hproxy-section-head" onClick={() => setOpen((v) => !v)}>
        <span className={`hproxy-section-chevron${open ? " open" : ""}`}>▶</span>
        <span className="hproxy-section-title">{title}</span>
        <span className="hproxy-section-desc">{desc}</span>
        <button className="hproxy-add-btn" onClick={(e) => { e.stopPropagation(); onAdd(); setOpen(true); }}>
          {addLabel}
        </button>
      </div>
      {open && <div className="hproxy-rows">{children}</div>}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function HttpProxy({ instanceId }: ToolProps) {
  const ns = `hproxy:${instanceId}`;

  const [port,     setPort]     = usePersistentState<number>(`${ns}:port`, 8080);
  const [dnsSpoofs, setDnsSpoofs] = usePersistentState<DnsSpoofRule[]>  (`${ns}:dnsspoofs`, []);
  const [mapRemotes,setMapRemotes] = usePersistentState<MapRemoteRule[]> (`${ns}:mapremotes`,[]);
  const [rewrites, setRewrites] = usePersistentState<PathRewriteRule[]>(`${ns}:rewrites`, []);
  const [injects,  setInjects]  = usePersistentState<ParamInjectRule[]>(`${ns}:injects`,  []);
  const [mapLocals,setMapLocals]= usePersistentState<MapLocalRule[]>   (`${ns}:maplocals`, []);
  const [blockLists,setBlockLists]= usePersistentState<BlockListRule[]>(`${ns}:blocklists`,[]);
  const [rewriteRules,setRewriteRules]= usePersistentState<RewriteRule[]>(`${ns}:rewrites2`,[]);
  const [noCaching, setNoCaching] = usePersistentState<boolean>(`${ns}:noCaching`, false);
  const [throttleEnabled, setThrottleEnabled] = usePersistentState<boolean>(`${ns}:throttleEn`, false);
  const [throttleBandwidth, setThrottleBandwidth] = usePersistentState<number>(`${ns}:throttleBw`, 100);
  const [throttleLatency, setThrottleLatency] = usePersistentState<number>(`${ns}:throttleLat`, 200);
  const [breakpoints, setBreakpoints] = usePersistentState<BreakpointRule[]>(`${ns}:breakpoints`, []);
  const [httpsDecrypt, setHttpsDecrypt] = usePersistentState<boolean>(`${ns}:httpsDec`, false);

  const [running, setRunning] = useState(false);
  const [rulesChanged, setRulesChanged] = useState(false);
  const [traffic, setTraffic] = useState<TrafficEntry[]>([]);
  const [hideUnmatched, setHideUnmatched] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"request" | "response">("response");
  const [bpHit, setBpHit] = useState<BreakpointHit | null>(null);
  const [bpEdit, setBpEdit] = useState({ method: "", url: "", headers: "", body: "", status: "" });
  const logEndRef = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const unlistenBpRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    invoke<{ running: boolean; port: number }>("get_proxy_status")
      .then(({ running: r, port: p }) => { setRunning(r); if (r) setPort(p); })
      .catch(() => {});
  }, []);

  // 规则变更时标记需要重新应用（只在运行中才提示）
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (running) setRulesChanged(true);
  }, [dnsSpoofs, mapRemotes, rewrites, injects, mapLocals, blockLists, rewriteRules, noCaching, breakpoints, throttleEnabled, throttleBandwidth, throttleLatency]);

  useEffect(() => {
    let cancelled = false;
    listen<TrafficEntry>("proxy-traffic", (ev) => {
      if (cancelled) return;
      setTraffic((prev) => {
        // 如果同 ID 条目已存在（流式响应先发初始事件再发最终事件），则更新而非追加
        const existingIdx = prev.findIndex((e) => e.id === ev.payload.id);
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = ev.payload;
          return next;
        }
        const next = [...prev, ev.payload];
        return next.length > 500 ? next.slice(-500) : next;
      });
    }).then((unlisten) => { if (cancelled) unlisten(); else unlistenRef.current = unlisten; });
    return () => { cancelled = true; unlistenRef.current?.(); unlistenRef.current = null; };
  }, []);

  // 断点事件监听
  useEffect(() => {
    let cancelled = false;
    listen<BreakpointHit>("proxy-breakpoint", (ev) => {
      if (cancelled) return;
      const hit = ev.payload;
      setBpHit(hit);
      setBpEdit({
        method: hit.method,
        url: hit.url,
        headers: hit.headers.map(([k, v]) => `${k}: ${v}`).join("\n"),
        body: hit.body,
        status: hit.status?.toString() ?? "",
      });
    }).then((unlisten) => { if (cancelled) unlisten(); else unlistenBpRef.current = unlisten; });
    return () => { cancelled = true; unlistenBpRef.current?.(); unlistenBpRef.current = null; };
  }, []);

  useEffect(() => { if (autoScroll) logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [traffic, autoScroll]);

  function allRules(): ProxyRule[] {
    return [
      ...dnsSpoofs.filter(r => r.enabled),
      ...mapRemotes.filter(r => r.enabled),
      ...rewrites.filter(r => r.enabled),
      ...injects.filter(r => r.enabled),
      ...mapLocals.filter(r => r.enabled),
      ...blockLists.filter(r => r.enabled),
      ...rewriteRules.filter(r => r.enabled),
    ];
  }

  function buildConfig(): ProxyConfig {
    return { rules: allRules(), noCaching, breakpoints, throttle: { enabled: throttleEnabled, bandwidth: throttleBandwidth, latency: throttleLatency }, httpsDecrypt };
  }

  async function startProxy() {
    try { await invoke("start_http_proxy", { port, config: buildConfig() }); setRunning(true); setRulesChanged(false); }
    catch (e) { console.error("start_http_proxy failed", e); }
  }
  async function applyRules() {
    try { await invoke("start_http_proxy", { port, config: buildConfig() }); setRulesChanged(false); }
    catch (e) { console.error("apply rules failed", e); }
  }
  async function stopProxy() {
    try { await invoke("stop_http_proxy"); setRunning(false); setRulesChanged(false); }
    catch (e) { console.error("stop_http_proxy failed", e); }
  }

  // ── 断点恢复 ──
  async function resumeBreakpoint(action: "resume" | "abort") {
    if (!bpHit) return;
    const headers: [string, string][] = bpEdit.headers
      .split("\n")
      .filter((l) => l.trim() && l.includes(":"))
      .map((l) => {
        const idx = l.indexOf(":");
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()] as [string, string];
      });
    await invoke("resume_breakpoint", {
      id: bpHit.id,
      data: {
        action,
        method: bpHit.phase === "request" ? bpEdit.method : undefined,
        url: bpHit.phase === "request" ? bpEdit.url : undefined,
        headers: bpHit.phase === "request" ? headers : undefined,
        body: bpEdit.body || undefined,
        status: bpHit.phase === "response" ? Number(bpEdit.status) || undefined : undefined,
      },
    });
    setBpHit(null);
  }

  // ── 规则 helper ──
  function updateDnsSpoof<K extends keyof DnsSpoofRule>(i: number, k: K, v: DnsSpoofRule[K]) { setDnsSpoofs((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r)); }
  function removeDnsSpoof(i: number) { setDnsSpoofs((p) => p.filter((_, idx) => idx !== i)); }
  function updateMapRemote<K extends keyof MapRemoteRule>(i: number, k: K, v: MapRemoteRule[K]) { setMapRemotes((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r)); }
  function removeMapRemote(i: number) { setMapRemotes((p) => p.filter((_, idx) => idx !== i)); }
  function updateRewrite<K extends keyof PathRewriteRule>(i: number, k: K, v: PathRewriteRule[K]) { setRewrites((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r)); }
  function removeRewrite(i: number) { setRewrites((p) => p.filter((_, idx) => idx !== i)); }
  function updateInject<K extends keyof Omit<ParamInjectRule, "type" | "params">>(i: number, k: K, v: ParamInjectRule[K]) { setInjects((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r)); }
  function removeInject(i: number) { setInjects((p) => p.filter((_, idx) => idx !== i)); }
  function addParam(i: number) { setInjects((p) => p.map((r, idx) => idx === i ? { ...r, params: [...r.params, { key: "", value: "" }] } : r)); }
  function updateParam(ri: number, pi: number, k: keyof ParamKV, v: string) { setInjects((p) => p.map((r, idx) => idx === ri ? { ...r, params: r.params.map((pm, pIdx) => pIdx === pi ? { ...pm, [k]: v } : pm) } : r)); }
  function removeParam(ri: number, pi: number) { setInjects((p) => p.map((r, idx) => idx === ri ? { ...r, params: r.params.filter((_, pIdx) => pIdx !== pi) } : r)); }

  function updateMapLocal<K extends keyof MapLocalRule>(i: number, k: K, v: MapLocalRule[K]) { setMapLocals((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r)); }
  function removeMapLocal(i: number) { setMapLocals((p) => p.filter((_, idx) => idx !== i)); }
  function updateBlockList<K extends keyof BlockListRule>(i: number, k: K, v: BlockListRule[K]) { setBlockLists((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r)); }
  function removeBlockList(i: number) { setBlockLists((p) => p.filter((_, idx) => idx !== i)); }
  function updateRewriteRule<K extends keyof RewriteRule>(i: number, k: K, v: RewriteRule[K]) { setRewriteRules((p) => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r)); }
  function removeRewriteRule(i: number) { setRewriteRules((p) => p.filter((_, idx) => idx !== i)); }

  const proxyAddr = `127.0.0.1:${port}`;

  // ── 过滤 ──
  const filteredTraffic = traffic.filter((e) => {
    if (hideUnmatched && !e.rule_matched) return false;
    if (methodFilter && e.method !== methodFilter) return false;
    if (statusFilter) {
      const s = e.status;
      if (statusFilter === "2xx" && !(s && s >= 200 && s < 300)) return false;
      if (statusFilter === "4xx" && !(s && s >= 400 && s < 500)) return false;
      if (statusFilter === "5xx" && !(s && s >= 500)) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const inUrl = e.url.toLowerCase().includes(q) || e.original_url.toLowerCase().includes(q);
      const inBody = e.res_body_preview.toLowerCase().includes(q) || e.req_body_preview.toLowerCase().includes(q);
      const inError = e.error?.toLowerCase().includes(q) ?? false;
      if (!inUrl && !inBody && !inError) return false;
    }
    return true;
  });

  const stats = {
    total: traffic.length,
    avgDur: traffic.length > 0 ? Math.round(traffic.filter(e => e.duration != null).reduce((a, e) => a + (e.duration ?? 0), 0) / Math.max(1, traffic.filter(e => e.duration != null).length)) : 0,
    errors: traffic.filter(e => e.error || (e.status && e.status >= 400)).length,
    matched: traffic.filter(e => e.rule_matched).length,
  };
  const methods = [...new Set(traffic.map(e => e.method))].sort();
  const expandedEntry = expandedId ? traffic.find((e) => e.id === expandedId) ?? null : null;

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div className="hproxy-root">
      {/* top bar */}
      <div className="hproxy-bar">
        <span className="hproxy-port-label">端口</span>
        <input className="hproxy-port" type="number" min={1} max={65535} value={port} disabled={running}
          onChange={(e) => setPort(Math.max(1, Math.min(65535, Number(e.target.value) || 8080)))} />
        {running
          ? <button className="hproxy-stop" onClick={stopProxy}>停止代理</button>
          : <button className="hproxy-start" onClick={startProxy}>启动代理</button>
        }
        {running && rulesChanged && (
          <button className="hproxy-apply-rules" onClick={applyRules} title="规则已修改，点击重新应用（代理将短暂重启）">应用规则</button>
        )}
        <div className="hproxy-status-wrap">
          <span className={`hproxy-dot ${running ? "running" : "stopped"}`} />
          <span className="hproxy-status-text">{running ? "运行中" : "已停止"}</span>
        </div>
        <span className="hproxy-addr-chip" title="点击复制代理地址" onClick={() => copyText(proxyAddr)}>{proxyAddr}</span>
        <label className={`hproxy-nocache-toggle ${noCaching ? "active" : ""}`}>
          <input type="checkbox" checked={noCaching} onChange={(e) => setNoCaching(e.target.checked)} />
          禁缓存
        </label>
        <label className={`hproxy-nocache-toggle ${throttleEnabled ? "active" : ""}`} title="模拟弱网限速">
          <input type="checkbox" checked={throttleEnabled} onChange={(e) => setThrottleEnabled(e.target.checked)} />
          限速
        </label>
        {throttleEnabled && (
          <span className="hproxy-throttle-opts">
            <input type="number" min={1} value={throttleBandwidth} onChange={(e) => setThrottleBandwidth(Number(e.target.value))} style={{ width: 60 }} /> KB/s
            <input type="number" min={0} value={throttleLatency} onChange={(e) => setThrottleLatency(Number(e.target.value))} style={{ width: 60 }} /> ms
          </span>
        )}
        <label className={`hproxy-nocache-toggle ${httpsDecrypt ? "active" : ""}`} title="开启后需要安装 CA 证书才能解密 HTTPS 内容；关闭时 HTTPS 纯透传，只有 DNS Spoofing 生效">
          <input type="checkbox" checked={httpsDecrypt} onChange={(e) => setHttpsDecrypt(e.target.checked)} />
          🔓 解密 HTTPS
        </label>
        {running && <span className="hproxy-tip">系统代理已自动设置为 127.0.0.1:{port}</span>}
        <button className="hproxy-nocache-toggle" onClick={async () => {
          try {
            const pem = await invoke<string>("init_ca");
            const blob = new Blob([pem], { type: "application/x-pem-file" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "desktool-ca.pem";
            a.click();
            URL.revokeObjectURL(a.href);
            copyText("", "CA 证书已下载，请双击安装到系统钥匙串并设为始终信任");
          } catch (e) { copyText("", "CA 初始化失败: " + String(e)); }
        }} title="下载 CA 证书用于 HTTPS 抓包">🔒 HTTPS CA</button>
      </div>

      {/* 断点指示器 */}
      {bpHit && (
        <div className="hproxy-bp-banner">
          <span className="hproxy-bp-icon">⏸</span>
          断点命中（{bpHit.phase === "request" ? "请求" : "响应"}）：{bpHit.method} {bpHit.url}
          <span className="hproxy-bp-hint">在下方弹窗中编辑后放行</span>
        </div>
      )}

      <div className="hproxy-body">
        {/* rules editor */}
        <div className="hproxy-rules">
          <Section title="DNS Spoofing" desc="域名强制解析到指定 IP，保留 Host 头（替代 hosts / 内网联调）"
            onAdd={() => setDnsSpoofs((p) => [...p, newDnsSpoof()])}>
            {dnsSpoofs.length === 0 && <div className="hproxy-empty-hint">暂无规则</div>}
            {dnsSpoofs.map((r, i) => (
              <div key={i} className={`hproxy-row${r.enabled ? "" : " hproxy-row-disabled"}`}>
                <button className={`hproxy-rule-toggle${r.enabled ? " on" : ""}`} onClick={() => updateDnsSpoof(i, "enabled", !r.enabled)} title={r.enabled ? "点击停用" : "点击启用"} />
                <span className="hproxy-row-label">域名</span>
                <input placeholder="api.example.com" value={r.host} onChange={(e) => updateDnsSpoof(i, "host", e.target.value)} />
                <span className="hproxy-row-label">→ IP</span>
                <input placeholder="192.168.1.100 或 192.168.1.100:8080" value={r.ip} onChange={(e) => updateDnsSpoof(i, "ip", e.target.value)} />
                <button className="hproxy-row-del" onClick={() => removeDnsSpoof(i)}>×</button>
              </div>
            ))}
          </Section>

          <Section title="Map Remote" desc="域名转发到另一个网络地址（切换测试/生产环境、线上调本地后端）"
            onAdd={() => setMapRemotes((p) => [...p, newMapRemote()])}>
            {mapRemotes.length === 0 && <div className="hproxy-empty-hint">暂无规则</div>}
            {mapRemotes.map((r, i) => (
              <div key={i} className={`hproxy-row hproxy-row-wide${r.enabled ? "" : " hproxy-row-disabled"}`}>
                <button className={`hproxy-rule-toggle${r.enabled ? " on" : ""}`} onClick={() => updateMapRemote(i, "enabled", !r.enabled)} />
                <span className="hproxy-row-label">host</span>
                <input placeholder="api.example.com" value={r.matchHost} onChange={(e) => updateMapRemote(i, "matchHost", e.target.value)} />
                <span className="hproxy-row-label">path</span>
                <input placeholder="/" value={r.matchPath} onChange={(e) => updateMapRemote(i, "matchPath", e.target.value)} />
                <span className="hproxy-row-label">→</span>
                <input className="hproxy-input-wide" placeholder="https://test.example.com 或 http://192.168.1.100:8080" value={r.targetUrl} onChange={(e) => updateMapRemote(i, "targetUrl", e.target.value)} />
                <button className="hproxy-row-del" onClick={() => removeMapRemote(i)}>×</button>
              </div>
            ))}
          </Section>

          <Section title="路径重写" desc="将匹配的 URL 路径前缀替换为新路径"
            onAdd={() => setRewrites((p) => [...p, newPathRewrite()])}>
            {rewrites.length === 0 && <div className="hproxy-empty-hint">暂无规则</div>}
            {rewrites.map((r, i) => (
              <div key={i} className={`hproxy-row${r.enabled ? "" : " hproxy-row-disabled"}`}>
                <button className={`hproxy-rule-toggle${r.enabled ? " on" : ""}`} onClick={() => updateRewrite(i, "enabled", !r.enabled)} />
                <span className="hproxy-row-label">host</span>
                <input placeholder="api.example.com" value={r.matchHost} onChange={(e) => updateRewrite(i, "matchHost", e.target.value)} />
                <span className="hproxy-row-label">前缀</span>
                <input placeholder="/v1" value={r.matchPrefix} onChange={(e) => updateRewrite(i, "matchPrefix", e.target.value)} />
                <span className="hproxy-row-label">→</span>
                <input placeholder="/v2" value={r.replacement} onChange={(e) => updateRewrite(i, "replacement", e.target.value)} />
                <button className="hproxy-row-del" onClick={() => removeRewrite(i)}>×</button>
              </div>
            ))}
          </Section>

          <Section title="参数注入" desc="为匹配请求自动注入 query 参数"
            onAdd={() => setInjects((p) => [...p, newParamInject()])}>
            {injects.length === 0 && <div className="hproxy-empty-hint">暂无规则</div>}
            {injects.map((r, ri) => (
              <div key={ri}>
                <div className={`hproxy-row${r.enabled ? "" : " hproxy-row-disabled"}`}>
                  <button className={`hproxy-rule-toggle${r.enabled ? " on" : ""}`} onClick={() => updateInject(ri, "enabled", !r.enabled)} />
                  <span className="hproxy-row-label">host</span>
                  <input placeholder="api.example.com" value={r.matchHost} onChange={(e) => updateInject(ri, "matchHost", e.target.value)} />
                  <span className="hproxy-row-label">path</span>
                  <input placeholder="/search" value={r.matchPath} onChange={(e) => updateInject(ri, "matchPath", e.target.value)} />
                  <button className="hproxy-row-del" onClick={() => removeInject(ri)}>×</button>
                </div>
                <div className="hproxy-params-block">
                  {r.params.map((p, pi) => (
                    <div key={pi} className="hproxy-param-row">
                      <input placeholder="key" value={p.key} onChange={(e) => updateParam(ri, pi, "key", e.target.value)} />
                      <span className="hproxy-param-eq">=</span>
                      <input placeholder="value" value={p.value} onChange={(e) => updateParam(ri, pi, "value", e.target.value)} />
                      <button className="hproxy-param-del" onClick={() => removeParam(ri, pi)}>×</button>
                    </div>
                  ))}
                  <button className="hproxy-add-param" onClick={() => addParam(ri)}>+ 参数</button>
                </div>
              </div>
            ))}
          </Section>

          <Section title="Map Local" desc="匹配 URL 后直接返回本地文件，不转发到服务器"
            onAdd={() => setMapLocals((p) => [...p, newMapLocal()])}>
            {mapLocals.length === 0 && <div className="hproxy-empty-hint">暂无规则</div>}
            {mapLocals.map((r, i) => (
              <div key={i} className={`hproxy-row hproxy-row-wide${r.enabled ? "" : " hproxy-row-disabled"}`}>
                <button className={`hproxy-rule-toggle${r.enabled ? " on" : ""}`} onClick={() => updateMapLocal(i, "enabled", !r.enabled)} />
                <span className="hproxy-row-label">host</span>
                <input placeholder="api.example.com" value={r.matchHost} onChange={(e) => updateMapLocal(i, "matchHost", e.target.value)} />
                <span className="hproxy-row-label">path</span>
                <input placeholder="/api/users" value={r.matchPath} onChange={(e) => updateMapLocal(i, "matchPath", e.target.value)} />
                <span className="hproxy-row-label">文件</span>
                <input className="hproxy-input-wide" placeholder="/path/to/mock.json" value={r.filePath} onChange={(e) => updateMapLocal(i, "filePath", e.target.value)} />
                <input className="hproxy-input-status" type="number" value={r.status} onChange={(e) => updateMapLocal(i, "status", Number(e.target.value) || 200)} title="状态码" />
                <input className="hproxy-input-ct" placeholder="Content-Type" value={r.contentType} onChange={(e) => updateMapLocal(i, "contentType", e.target.value)} />
                <button className="hproxy-row-del" onClick={() => removeMapLocal(i)}>×</button>
              </div>
            ))}
          </Section>

          <Section title="Block List" desc="按域名/路径拦截请求，返回指定状态码"
            onAdd={() => setBlockLists((p) => [...p, newBlockList()])}>
            {blockLists.length === 0 && <div className="hproxy-empty-hint">暂无规则</div>}
            {blockLists.map((r, i) => (
              <div key={i} className={`hproxy-row${r.enabled ? "" : " hproxy-row-disabled"}`}>
                <button className={`hproxy-rule-toggle${r.enabled ? " on" : ""}`} onClick={() => updateBlockList(i, "enabled", !r.enabled)} />
                <span className="hproxy-row-label">host</span>
                <input placeholder="ads.example.com" value={r.matchHost} onChange={(e) => updateBlockList(i, "matchHost", e.target.value)} />
                <span className="hproxy-row-label">path</span>
                <input placeholder="/track" value={r.matchPath} onChange={(e) => updateBlockList(i, "matchPath", e.target.value)} />
                <span className="hproxy-row-label">状态</span>
                <input className="hproxy-input-status" type="number" value={r.status} onChange={(e) => updateBlockList(i, "status", Number(e.target.value) || 404)} />
                <button className="hproxy-row-del" onClick={() => removeBlockList(i)}>×</button>
              </div>
            ))}
          </Section>

          <Section title="Rewrite 改写" desc="正则替换请求体/响应体/状态码"
            onAdd={() => setRewriteRules((p) => [...p, newRewrite()])}>
            {rewriteRules.length === 0 && <div className="hproxy-empty-hint">暂无规则</div>}
            {rewriteRules.map((r, i) => (
              <div key={i} className={`hproxy-row hproxy-row-wide${r.enabled ? "" : " hproxy-row-disabled"}`}>
                <button className={`hproxy-rule-toggle${r.enabled ? " on" : ""}`} onClick={() => updateRewriteRule(i, "enabled", !r.enabled)} />
                <span className="hproxy-row-label">host</span>
                <input placeholder="api.example.com" value={r.matchHost} onChange={(e) => updateRewriteRule(i, "matchHost", e.target.value)} />
                <span className="hproxy-row-label">path</span>
                <input placeholder="/api" value={r.matchPath} onChange={(e) => updateRewriteRule(i, "matchPath", e.target.value)} />
                <select className="hproxy-rewrite-target" value={r.target} onChange={(e) => updateRewriteRule(i, "target", e.target.value)}>
                  <option value="req_body">请求体</option>
                  <option value="res_body">响应体</option>
                  <option value="res_status">状态码</option>
                </select>
                <input className="hproxy-input-regex" placeholder="正则 pattern" value={r.pattern} onChange={(e) => updateRewriteRule(i, "pattern", e.target.value)} />
                <span className="hproxy-row-label">→</span>
                <input className="hproxy-input-regex" placeholder="替换文本" value={r.replacement} onChange={(e) => updateRewriteRule(i, "replacement", e.target.value)} />
                <button className="hproxy-row-del" onClick={() => removeRewriteRule(i)}>×</button>
              </div>
            ))}
          </Section>

          <Section title="断点" desc="请求/响应到达时暂停，手动修改后放行" addLabel="+ 添加断点"
            onAdd={() => setBreakpoints((p) => [...p, { matchHost: "", matchPath: "/", phase: "request" }])}>
            {breakpoints.length === 0 && <div className="hproxy-empty-hint">暂无断点</div>}
            {breakpoints.map((bp, i) => (
              <div key={i} className="hproxy-row">
                <select className="hproxy-bp-phase" value={bp.phase} onChange={(e) => setBreakpoints((p) => p.map((b, idx) => idx === i ? { ...b, phase: e.target.value as "request" | "response" } : b))}>
                  <option value="request">请求</option>
                  <option value="response">响应</option>
                </select>
                <span className="hproxy-row-label">host</span>
                <input placeholder="api.example.com" value={bp.matchHost} onChange={(e) => setBreakpoints((p) => p.map((b, idx) => idx === i ? { ...b, matchHost: e.target.value } : b))} />
                <span className="hproxy-row-label">path</span>
                <input placeholder="/api" value={bp.matchPath} onChange={(e) => setBreakpoints((p) => p.map((b, idx) => idx === i ? { ...b, matchPath: e.target.value } : b))} />
                <button className="hproxy-row-del" onClick={() => setBreakpoints((p) => p.filter((_, idx) => idx !== i))}>×</button>
              </div>
            ))}
          </Section>
        </div>

        {/* traffic log */}
        <div className="hproxy-log-wrap">
          <div className="hproxy-log-head">
            <span className="hproxy-log-title">流量日志</span>
            <div className="hproxy-stats">
              <span className="hproxy-stat">共 {stats.total}</span>
              {stats.matched > 0 && <span className="hproxy-stat hproxy-stat-matched">命中 {stats.matched}</span>}
              {stats.avgDur > 0 && <span className="hproxy-stat">均 {stats.avgDur}ms</span>}
              {stats.errors > 0 && <span className="hproxy-stat hproxy-stat-err">错误 {stats.errors}</span>}
            </div>
            <input className="hproxy-search" type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索 URL / Body / 错误…" spellCheck={false} />
            {methods.length > 0 && (
              <div className="hproxy-filter-group">
                <button className={`hproxy-filter-btn ${methodFilter === "" ? "active" : ""}`} onClick={() => setMethodFilter("")}>全部</button>
                {methods.map((m) => <button key={m} className={`hproxy-filter-btn ${methodFilter === m ? "active" : ""}`} onClick={() => setMethodFilter(methodFilter === m ? "" : m)}>{m}</button>)}
              </div>
            )}
            <div className="hproxy-filter-group">
              <button className={`hproxy-filter-btn hproxy-filter-status ${statusFilter === "" ? "active" : ""}`} onClick={() => setStatusFilter("")}>全部</button>
              <button className={`hproxy-filter-btn hproxy-filter-ok ${statusFilter === "2xx" ? "active" : ""}`} onClick={() => setStatusFilter(statusFilter === "2xx" ? "" : "2xx")}>2xx</button>
              <button className={`hproxy-filter-btn hproxy-filter-warn ${statusFilter === "4xx" ? "active" : ""}`} onClick={() => setStatusFilter(statusFilter === "4xx" ? "" : "4xx")}>4xx</button>
              <button className={`hproxy-filter-btn hproxy-filter-err ${statusFilter === "5xx" ? "active" : ""}`} onClick={() => setStatusFilter(statusFilter === "5xx" ? "" : "5xx")}>5xx</button>
            </div>
            <button className={`hproxy-log-toggle ${autoScroll ? "active" : ""}`} onClick={() => setAutoScroll((v) => !v)}>{autoScroll ? "↓ 自动滚动" : "↓ 停止滚动"}</button>
            <button className={`hproxy-log-filter ${hideUnmatched ? "active" : ""}`} onClick={() => setHideUnmatched((v) => !v)}>{hideUnmatched ? "🔍 仅命中" : "全部"}</button>
            <button className="hproxy-log-clear" onClick={() => setTraffic([])}>清空</button>
            <button className="hproxy-log-clear" onClick={() => exportHar(traffic)} disabled={traffic.length === 0} title="导出为 HAR 格式">导出 HAR</button>
          </div>

          <div className={`hproxy-log-split ${expandedEntry ? "has-detail" : ""}`}>
            <div className="hproxy-log-table-wrap">
              {traffic.length === 0 ? (
                <div className="hproxy-log-empty">暂无流量记录，启动代理后请求会显示在这里</div>
              ) : filteredTraffic.length === 0 ? (
                <div className="hproxy-log-empty">没有匹配过滤条件的流量记录</div>
              ) : (
                <table className="hproxy-log-table">
                  <colgroup>
                    <col className="hproxy-col-time" /><col className="hproxy-col-method" />
                    <col className="hproxy-col-status" /><col className="hproxy-col-dur" />
                    <col className="hproxy-col-peer" /><col className="hproxy-col-url" />
                  </colgroup>
                  <thead><tr><th>时间</th><th>方法</th><th>状态</th><th>耗时</th><th>来源</th><th>URL（点击查看详情）</th></tr></thead>
                  <tbody>
                    {filteredTraffic.map((entry) => {
                      const isExpanded = expandedId === entry.id;
                      const urlChanged = entry.url !== entry.original_url;
                      return (
                        <tr key={entry.id} className={["hproxy-data-row", entry.rule_matched ? "hproxy-row-matched" : "", isExpanded ? "hproxy-row-expanded" : ""].join(" ")}
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)} style={{ cursor: "pointer" }}>
                          <td>{fmtTs(entry.timestamp)}</td>
                          <td><span className="hproxy-method">{entry.method}</span></td>
                          <td className={statusClass(entry.status)}>{entry.status ?? "—"}</td>
                          <td>{entry.duration != null ? `${entry.duration}ms` : "—"}</td>
                          <td className="hproxy-peer-cell" title={entry.peer_addr}>{entry.peer_addr}</td>
                          <td className="hproxy-url-cell">
                            {urlChanged ? (
                              <span className="hproxy-url-pair">
                                <span className="hproxy-url-orig" title={entry.original_url}>{entry.original_url}</span>
                                <span className="hproxy-url-arrow">→</span>
                                <span className="hproxy-url-rewritten" title={entry.url}>{entry.url}</span>
                              </span>
                            ) : <span className="hproxy-url-plain" title={entry.url}>{entry.url}</span>}
                            {entry.error && <span className="hproxy-err-inline" title={entry.error}> ⚠ {entry.error}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <div ref={logEndRef} />
            </div>

            {/* 详情面板 */}
            {expandedEntry && (
              <div className="hproxy-detail-panel">
                <div className="hproxy-detail-panel-head">
                  <div className="hproxy-detail-tabs">
                    <button className={`hproxy-detail-tab ${detailTab === "request" ? "active" : ""}`} onClick={() => setDetailTab("request")}>📤 请求</button>
                    <button className={`hproxy-detail-tab ${detailTab === "response" ? "active" : ""}`} onClick={() => setDetailTab("response")}>📥 响应</button>
                  </div>
                  <div className="hproxy-detail-panel-actions">
                    {detailTab === "request" && expandedEntry.req_body_preview && (
                      <button className="hproxy-detail-action" onClick={() => copyText(prettyBody(expandedEntry.req_body_preview), "请求 Body 已复制")}>📋 复制 Body</button>
                    )}
                    {detailTab === "response" && expandedEntry.res_body_preview && (
                      <button className="hproxy-detail-action" onClick={() => copyText(prettyBody(expandedEntry.res_body_preview), "响应 Body 已复制")}>📋 复制 Body</button>
                    )}
                    <button className="hproxy-detail-action hproxy-detail-action-curl" onClick={() => copyText(toCurl(expandedEntry), "curl 命令已复制")} title="将此请求转为 curl 命令">⌘ 复制为 curl</button>
                    <button className="hproxy-detail-action" onClick={() => repeatRequest(expandedEntry)} title="用相同参数重新发送此请求">↻ 重放</button>
                    <button className="hproxy-detail-action" onClick={() => mirrorEntry(expandedEntry)} title="保存此流量到磁盘">💾 镜像</button>
                    <button className="hproxy-detail-action hproxy-detail-action-compose" onClick={() => { dispatchCompose({ method: expandedEntry.method, url: expandedEntry.url, headers: expandedEntry.req_headers, body: expandedEntry.req_body_preview }); }} title="将此请求填入简易 Postman 编辑重发">✏ 编辑重发</button>
                    <button className="hproxy-detail-action" onClick={() => copyText(expandedEntry.original_url, "URL 已复制")}>复制 URL</button>
                    <button className="hproxy-detail-close" onClick={() => setExpandedId(null)}>✕</button>
                  </div>
                </div>
                <div className="hproxy-detail-panel-body">
                  {detailTab === "request" ? (
                    <div className="hproxy-detail-pane">
                      <div className="hproxy-detail-kv-wrap">
                        <div className="hproxy-detail-url-line">
                          <span className="hproxy-detail-method">{expandedEntry.method}</span>
                          <span className="hproxy-detail-url">{expandedEntry.url}</span>
                        </div>
                        {expandedEntry.req_headers.map(([k, v], i) => (
                          <div key={i} className="hproxy-detail-kv"><span className="hproxy-detail-key">{k}</span><span className="hproxy-detail-val">{v}</span></div>
                        ))}
                      </div>
                      {expandedEntry.req_body_preview ? <pre className="hproxy-detail-body">{prettyBody(expandedEntry.req_body_preview)}</pre> : <div className="hproxy-detail-no-body">无请求体</div>}
                    </div>
                  ) : (
                    <div className="hproxy-detail-pane">
                      {expandedEntry.error ? (
                        <div className="hproxy-detail-error">⚠ {expandedEntry.error}</div>
                      ) : (
                        <>
                          <div className="hproxy-detail-kv-wrap">
                            <div className="hproxy-detail-url-line">
                              <span className={`hproxy-detail-status ${statusClass(expandedEntry.status)}`}>{expandedEntry.status ?? "—"}</span>
                              {expandedEntry.duration != null && <span className="hproxy-detail-dur">{expandedEntry.duration}ms</span>}
                              {expandedEntry.res_body_size > 0 && <span className="hproxy-detail-size">{fmtBytes(expandedEntry.res_body_size)}</span>}
                            </div>
                            {expandedEntry.res_headers.map(([k, v], i) => (
                              <div key={i} className="hproxy-detail-kv"><span className="hproxy-detail-key">{k}</span><span className="hproxy-detail-val">{v}</span></div>
                            ))}
                          </div>
                          {expandedEntry.res_body_preview ? <pre className="hproxy-detail-body">{prettyBody(expandedEntry.res_body_preview)}</pre> : <div className="hproxy-detail-no-body">无响应体</div>}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 断点编辑弹窗 */}
      {bpHit && (
        <div className="hproxy-bp-overlay">
          <div className="hproxy-bp-modal">
            <div className="hproxy-bp-modal-title">
              ⏸ 断点：{bpHit.phase === "request" ? "请求" : "响应"} — {bpHit.method} {bpHit.url}
            </div>
            <div className="hproxy-bp-edit">
              {bpHit.phase === "request" && (
                <>
                  <div className="hproxy-bp-row">
                    <label>Method</label>
                    <input value={bpEdit.method} onChange={(e) => setBpEdit({ ...bpEdit, method: e.target.value })} />
                  </div>
                  <div className="hproxy-bp-row">
                    <label>URL</label>
                    <input value={bpEdit.url} onChange={(e) => setBpEdit({ ...bpEdit, url: e.target.value })} />
                  </div>
                </>
              )}
              {bpHit.phase === "response" && (
                <div className="hproxy-bp-row">
                  <label>Status</label>
                  <input type="number" value={bpEdit.status} onChange={(e) => setBpEdit({ ...bpEdit, status: e.target.value })} />
                </div>
              )}
              <div className="hproxy-bp-row">
                <label>Headers</label>
                <textarea value={bpEdit.headers} onChange={(e) => setBpEdit({ ...bpEdit, headers: e.target.value })}
                  placeholder="key: value（每行一个）" rows={4} spellCheck={false} />
              </div>
              <div className="hproxy-bp-row">
                <label>Body</label>
                <textarea value={bpEdit.body} onChange={(e) => setBpEdit({ ...bpEdit, body: e.target.value })}
                  placeholder="请求体/响应体" rows={8} spellCheck={false} />
              </div>
            </div>
            <div className="hproxy-bp-actions">
              <button className="hproxy-bp-abort" onClick={() => resumeBreakpoint("abort")}>中止</button>
              <button className="hproxy-bp-resume" onClick={() => resumeBreakpoint("resume")}>放行</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
