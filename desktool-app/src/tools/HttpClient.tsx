import { useState, useEffect, useRef } from "react";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText } from "../useCopyFeedback";
import { parseCurl, splitUrlParams } from "./parseCurl";
import { resolveBuiltins, BUILTIN_FNS } from "./builtins";
import { addEntry, updateEntry } from "./networkLog";
import { useSubTabs } from "./useSubTabs";
import SubTabBar from "./SubTabBar";
import NetworkPanel from "./NetworkPanel";
import BuiltinInput from "./BuiltinInput";
import JsonTree from "./JsonTree";
import { buildMultipart, buildUrlEncoded } from "./buildMultipart";
import type { FormField } from "./buildMultipart";
import { openBinaryFile } from "../openFile";
import { useEnvs } from "./envState";
import { listenCompose } from "./proxyCompose";
import { saveTextWithDialog } from "../saveFile";
import "./HttpClient.css";

type Method = "GET" | "POST" | "HEAD" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";
const METHODS: Method[] = ["GET", "POST", "HEAD", "PUT", "DELETE", "PATCH", "OPTIONS"];
type BodyType = "raw" | "form-data" | "urlencoded" | "graphql";

interface Header {
  key: string;
  value: string;
}

interface KV {
  key: string;
  value: string;
}

interface FavRequest {
  id: string;
  name: string;
  method: Method;
  url: string;
  headers: Header[];
  body: string;
  bodyType: BodyType;
  group?: string;
}

interface Resp {
  status: number;
  statusText: string;
  timeMs: number;
  headers: [string, string][];
  body: string;
  bodySize: number;
  contentType: string;
}

function prettyBody(text: string, contentType: string): string {
  if (contentType.includes("json") || /^[\s]*[[{]/.test(text)) {
    try { return JSON.stringify(JSON.parse(text), null, 2); } catch { }
  }
  return text;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** 根据 raw body 内容推断 Content-Type */
function guessContentType(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "application/json";
  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<")) return "application/xml";
  return null;
}

const COMMON_HEADERS = [
  "Accept", "Accept-Charset", "Accept-Encoding", "Accept-Language",
  "Authorization", "Cache-Control", "Content-Disposition",
  "Content-Type", "Cookie", "Date", "ETag", "Expect",
  "Forwarded", "Host", "If-Match", "If-Modified-Since",
  "If-None-Match", "If-Range", "If-Unmodified-Since",
  "Origin", "Pragma", "Range", "Referer", "TE", "Trailer",
  "Transfer-Encoding", "Upgrade", "User-Agent", "Via", "Warning",
  "X-API-Key", "X-Auth-Token", "X-Forwarded-For", "X-Request-ID",
];

function resolveVars(str: string, vars: KV[]): string {
  let s = str;
  for (const v of vars) {
    if (v.key.trim()) s = s.split(`{{${v.key.trim()}}}`).join(v.value);
  }
  return s;
}

function buildCurl(method: string, url: string, headers: Header[], body: string): string {
  const parts = [`curl -X ${method} '${url}'`];
  for (const h of headers) {
    if (h.key.trim()) parts.push(`  -H '${h.key}: ${h.value}'`);
  }
  if (body.trim()) parts.push(`  -d '${body.replace(/'/g, "'\\''")}'`);
  return parts.join(" \\\n");
}

export default function HttpClient({ instanceId }: ToolProps) {
  const stb = useSubTabs(`http:${instanceId}`, "请求 1");
  const ns = stb.subNs;
  const { envs, activeId, activeEnv, activeVars, setActive } = useEnvs();
  const [method, setMethod] = usePersistentState<Method>(`${ns}:method`, "GET");
  const [url, setUrl] = usePersistentState(`${ns}:url`, "");
  const [headers, setHeaders] = usePersistentState<Header[]>(`${ns}:headers`, [{ key: "", value: "" }]);
  const [body, setBody] = usePersistentState(`${ns}:body`, "");
  const [bodyType, setBodyType] = usePersistentState<BodyType>(`${ns}:bodyType`, "raw");
  const [formFields, setFormFields] = usePersistentState<FormField[]>(`${ns}:formFields`, [{ key: "", valueType: "text", value: "" }]);
  const [params, setParams] = usePersistentState<KV[]>(`${ns}:params`, []);
  const [vars, setVars] = usePersistentState<KV[]>(`${ns}:vars`, []);
  const [authType, setAuthType] = usePersistentState<"none"|"bearer"|"basic"|"apikey">(`${ns}:authType`, "none");
  const [authVal, setAuthVal] = usePersistentState(`${ns}:authVal`, "");
  const [authKey, setAuthKey] = usePersistentState(`${ns}:authKey`, "X-API-Key");
  const [authUser, setAuthUser] = usePersistentState(`${ns}:authUser`, "");
  const [authPass, setAuthPass] = usePersistentState(`${ns}:authPass`, "");
  const [tab, setTab] = useState<"headers" | "query" | "body" | "vars" | "auth">("headers");
  const [resp, setResp] = useState<Resp | null>(null);
  const [respTab, setRespTab] = useState<"body" | "headers">("body");
  const [respView, setRespView] = useState<"text" | "tree">("tree");
  const [headerSearch, setHeaderSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [timeoutMs, setTimeoutMs] = usePersistentState(`${ns}:timeout`, 30000);
  const abortRef = useRef<AbortController | null>(null);
  const [curlOpen, setCurlOpen] = useState(false);
  const [curlText, setCurlText] = useState("");
  const [curlErr, setCurlErr] = useState("");
  const [showRef, setShowRef] = useState(false);
  const [showFavs, setShowFavs] = useState(false);
  const [favs, setFavs] = usePersistentState<FavRequest[]>(`http:favs`, []);
  const [favName, setFavName] = useState("");
  const [favGroup, setFavGroup] = useState("");
  const [urlHistory, setUrlHistory] = usePersistentState<string[]>(`http:urlhist`, []);
  const [gqlQuery, setGqlQuery] = usePersistentState(`${ns}:gql`, "");
  const [gqlVars, setGqlVars] = usePersistentState(`${ns}:gqlvars`, "");

  // Compose：从 HTTP 代理接收流量数据，填入当前 tab
  useEffect(() => {
    return listenCompose((data) => {
      const m = (METHODS.includes(data.method as Method) ? data.method : "GET") as Method;
      setMethod(m);
      setUrl(data.url);
      setHeaders(data.headers.length
        ? data.headers.map(([k, v]) => ({ key: k, value: v }))
        : [{ key: "", value: "" }]);
      setBody(data.body);
      setTab(data.body ? "body" : "headers");
      if (data.body) setBodyType("raw");
    });
  }, []);

  /** 应用 parsedCurl 结果到各状态字段 */
  function applyCurl(v: string) {
    setCurlErr("");
    try {
      const p = parseCurl(v);
      const m = (METHODS.includes(p.method as Method) ? p.method : "POST") as Method;
      setMethod(m);
      setUrl(p.url);
      setHeaders(p.headers.length ? p.headers : [{ key: "", value: "" }]);
      setBody(p.body);
      // 同步 URL 中的查询参数到 params 列表
      if (p.params.length) {
        setParams(p.params);
        setTab("query");
      } else if (p.body) {
        setTab("body");
      }
    } catch (e) {
      setCurlErr((e as Error).message);
    }
  }

  function importCurl() {
    applyCurl(curlText);
    if (!curlErr) {
      setCurlOpen(false);
      setCurlText("");
    }
  }

  /** URL 失焦时：解析查询参数 → 写入 params 列表 */
  function syncParamsFromUrl(rawUrl: string) {
    const { base, params: urlParams } = splitUrlParams(rawUrl);
    if (urlParams.length) {
      setUrl(base);
      // 合并：已有 params 中相同 key 的保留新值，新 key 追加
      setParams((prev) => {
        const merged = [...prev];
        for (const np of urlParams) {
          const idx = merged.findIndex((p) => p.key === np.key);
          if (idx >= 0) merged[idx] = np;
          else merged.push(np);
        }
        return merged.filter((p) => p.key.trim());
      });
    }
  }

  function handleMethodChange(m: Method) {
    setMethod(m);
    // POST / PUT / PATCH 时自动切到请求体 tab
    if (["POST", "PUT", "PATCH"].includes(m)) {
      setTab("body");
    }
  }

  // ---- header helpers ----
  function setHeader(i: number, patch: Partial<Header>) {
    setHeaders((hs) => hs.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  }
  function addHeader() { setHeaders((hs) => [...hs, { key: "", value: "" }]); }
  function removeHeader(i: number) { setHeaders((hs) => hs.filter((_, idx) => idx !== i)); }

  // ---- param helpers ----
  function setParam(i: number, patch: Partial<KV>) {
    setParams((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function addParam() { setParams((ps) => [...ps, { key: "", value: "" }]); }
  function removeParam(i: number) { setParams((ps) => ps.filter((_, idx) => idx !== i)); }

  // ---- var helpers ----
  function setVar(i: number, patch: Partial<KV>) {
    setVars((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }
  function addVar() { setVars((vs) => [...vs, { key: "", value: "" }]); }
  function removeVar(i: number) { setVars((vs) => vs.filter((_, idx) => idx !== i)); }

  // ---- form-data helpers ----
  function setFormField(i: number, patch: Partial<FormField>) {
    setFormFields((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  function addFormField() {
    setFormFields((fs) => [...fs, { key: "", valueType: "text", value: "" }]);
  }
  function removeFormField(i: number) {
    setFormFields((fs) => fs.filter((_, idx) => idx !== i));
  }
  async function pickFile(i: number) {
    const result = await openBinaryFile();
    if (result) {
      setFormField(i, {
        valueType: "file",
        fileName: result.name,
        fileData: result.bytes,
        mimeType: guessMime(result.name),
        value: result.name,
      });
    }
  }
  function guessMime(name: string): string {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const map: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
      gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
      pdf: "application/pdf", zip: "application/zip",
      txt: "text/plain", csv: "text/csv",
      json: "application/json", xml: "application/xml",
    };
    return map[ext] ?? "application/octet-stream";
  }

  async function send() {
    setError("");
    setResp(null);
    if (!url.trim()) { setError("请输入 URL"); return; }
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    const t0 = performance.now();
    // 合并变量：环境变量优先级低，本地 vars 可覆盖同名环境变量
    const mergedVars = [...activeVars];
    for (const lv of vars) {
      if (lv.key.trim()) {
        const idx = mergedVars.findIndex((m) => m.key === lv.key.trim());
        if (idx >= 0) mergedVars[idx] = lv;
        else mergedVars.push(lv);
      }
    }
    const applyAll = (s: string) => resolveBuiltins(resolveVars(s, mergedVars));

    // Build final URL with params merged
    let finalUrl = applyAll(url.trim());
    const activeParams = params.filter((p) => p.key.trim());
    if (activeParams.length) {
      try {
        const u = new URL(finalUrl.includes("://") ? finalUrl : `http://${finalUrl}`);
        for (const p of activeParams) u.searchParams.set(p.key.trim(), p.value);
        finalUrl = finalUrl.includes("://") ? u.toString() : u.toString().replace("http://", "");
      } catch { /* malformed URL — skip param merge */ }
    }

    const hdrs: Record<string, string> = {};
    for (const h of headers) {
      if (h.key.trim()) hdrs[h.key.trim()] = applyAll(h.value);
    }

    // Inject auth header only if not already set manually
    const hdrLower = Object.keys(hdrs).map((k) => k.toLowerCase());
    if (authType === "bearer" && authVal.trim() && !hdrLower.includes("authorization")) {
      hdrs["Authorization"] = `Bearer ${authVal}`;
    } else if (authType === "basic" && authUser.trim() && !hdrLower.includes("authorization")) {
      hdrs["Authorization"] = `Basic ${btoa(`${authUser}:${authPass}`)}`;
    } else if (authType === "apikey" && authKey.trim() && authVal.trim() && !hdrLower.includes(authKey.trim().toLowerCase())) {
      hdrs[authKey.trim()] = authVal;
    }

    // Build body based on bodyType
    let finalBody: string | Uint8Array | undefined;
    const hasBody = method !== "GET" && method !== "HEAD";
    if (hasBody) {
      if (bodyType === "graphql") {
        const gqlBody: Record<string, unknown> = { query: gqlQuery };
        if (gqlVars.trim()) {
          try { gqlBody.variables = JSON.parse(gqlVars); } catch { /* ignore invalid vars */ }
        }
        finalBody = JSON.stringify(gqlBody);
        if (!hdrLower.includes("content-type")) hdrs["Content-Type"] = "application/json";
      } else if (bodyType === "raw" && body.trim()) {
        finalBody = applyAll(body);
        // 自动推断 Content-Type（用户未手动设置时）
        if (!hdrLower.includes("content-type")) {
          const guessed = guessContentType(finalBody);
          if (guessed) hdrs["Content-Type"] = guessed;
        }
      } else if (bodyType === "form-data") {
        const { body: multiBody, boundary } = buildMultipart(formFields);
        finalBody = multiBody;
        hdrs["Content-Type"] = `multipart/form-data; boundary=${boundary}`;
      } else if (bodyType === "urlencoded") {
        finalBody = buildUrlEncoded(formFields);
        if (!hdrLower.includes("content-type"))
          hdrs["Content-Type"] = "application/x-www-form-urlencoded";
      }
    }

    const logId = addEntry({
      tool: "http", type: "http", method, url: finalUrl,
      reqHeaders: hdrs,
      reqBody: typeof finalBody === "string" ? finalBody : finalBody ? `[binary ${finalBody.length} bytes]` : undefined,
      state: "pending",
    });
    try {
      const r = await tauriFetch(finalUrl, { method, headers: hdrs, body: finalBody, signal: ac.signal, connectTimeout: timeoutMs });
      const respHeaders: [string, string][] = [];
      r.headers.forEach((v, k) => respHeaders.push([k, v]));
      const ct = r.headers.get("content-type") ?? "";

      // 判断是否为流式响应（SSE / NDJSON / chunked / 无 Content-Length）
      const isStreaming = ct.includes("text/event-stream")
        || ct.includes("application/x-ndjson")
        || ct.includes("application/stream+json")
        || ct.includes("application/octet-stream")
        || !r.headers.get("content-length");

      if (isStreaming && r.body) {
        // ── 流式读取 ──
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let streamedText = "";
        let bodySize = 0;
        setResp({ status: r.status, statusText: r.statusText, timeMs: 0, headers: respHeaders, body: "", bodySize: 0, contentType: ct });
        setRespTab("body");
        setRespView("text");

        while (true) {
          if (ac.signal.aborted) { reader.cancel(); break; }
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            bodySize += value.length;
            streamedText += decoder.decode(value, { stream: true });
            // 实时更新响应体（限制显示长度避免卡顿）
            const displayText = streamedText.length > 100000
              ? streamedText.slice(-100000) + "\n\n... [已截断，仅显示最后 100KB]"
              : streamedText;
            setResp((prev) => prev ? { ...prev, body: displayText, bodySize } : null);
            updateEntry(logId, { resBody: streamedText, state: "streaming" });
          }
        }
        const dur = Math.round(performance.now() - t0);
        setResp((prev) => prev ? { ...prev, body: streamedText, bodySize, timeMs: dur } : null);
        if (url.trim()) {
          setUrlHistory((h) => {
            const filtered = h.filter((u) => u !== url.trim());
            return [url.trim(), ...filtered].slice(0, 50);
          });
        }
        updateEntry(logId, { status: r.status, statusText: r.statusText, resHeaders: respHeaders, resBody: streamedText, duration: dur, state: "done" });
      } else {
        // ── 普通一次性读取 ──
        const text = await r.text();
        const dur = Math.round(performance.now() - t0);
        const pretty = prettyBody(text, ct);
        const bodySize = new Blob([text]).size;
        setResp({ status: r.status, statusText: r.statusText, timeMs: dur, headers: respHeaders, body: pretty, bodySize, contentType: ct });
        if (url.trim()) {
          setUrlHistory((h) => {
            const filtered = h.filter((u) => u !== url.trim());
            return [url.trim(), ...filtered].slice(0, 50);
          });
        }
        try { JSON.parse(pretty); setRespView("tree"); } catch { setRespView("text"); }
        setRespTab("body");
        updateEntry(logId, { status: r.status, statusText: r.statusText, resHeaders: respHeaders, resBody: text, duration: dur, state: "done" });
      }
    } catch (e) {
      const msg = (e as Error).message;
      setError(`请求失败：${msg}`);
      updateEntry(logId, { error: msg, duration: Math.round(performance.now() - t0), state: "error" });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  // ---- favorite helpers ----
  function saveFav() {
    const name = favName.trim() || url.trim() || "未命名";
    const fav: FavRequest = {
      id: crypto.randomUUID(),
      name,
      method,
      url,
      headers: [...headers],
      body,
      bodyType,
      group: favGroup.trim() || undefined,
    };
    setFavs((f) => [...f, fav]);
    setFavName("");
    setFavGroup("");
  }

  function loadFav(f: FavRequest) {
    setMethod(f.method);
    setUrl(f.url);
    setHeaders(f.headers.length ? f.headers : [{ key: "", value: "" }]);
    setBody(f.body);
    setBodyType(f.bodyType);
    setShowFavs(false);
  }

  function deleteFav(id: string) {
    setFavs((f) => f.filter((x) => x.id !== id));
  }

  // ---- save response to file ----
  async function saveRespToFile() {
    if (!resp) return;
    const ct = resp.contentType;
    let ext = "txt";
    if (ct.includes("json")) ext = "json";
    else if (ct.includes("xml")) ext = "xml";
    else if (ct.includes("html")) ext = "html";
    else if (ct.includes("image/png")) ext = "png";
    else if (ct.includes("image/jpeg")) ext = "jpg";
    else if (ct.includes("image/svg")) ext = "svg";
    const res = await saveTextWithDialog(resp.body, `response.${ext}`);
    if (res.saved) copyText("", "已保存到 " + res.path);
  }

  // ---- header Tab key navigation: Tab on last value auto-adds next row ----
  function headerKeyDown(e: React.KeyboardEvent, i: number, field: "key" | "value") {
    if (e.key === "Tab" && !e.shiftKey && field === "value" && i === headers.length - 1) {
      e.preventDefault();
      addHeader();
    }
  }
  const statusClass = resp ? (resp.status < 300 ? "ok" : resp.status < 400 ? "warn" : "err") : "";
  const varsCount = vars.filter((v) => v.key.trim()).length;
  const bodyHasContent = bodyType === "raw" ? body.trim().length > 0 : bodyType === "graphql" ? gqlQuery.trim().length > 0 : formFields.some((f) => f.key.trim());

  return (
    <div className="hc-tool">
      <SubTabBar tabs={stb.tabs} activeId={stb.activeId} onSelect={stb.setActiveId} onAdd={stb.add} onDelete={stb.remove} onRename={stb.rename} />
      {curlOpen && (
        <div className="hc-overlay" onClick={() => setCurlOpen(false)}>
          <div className="hc-curl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hc-curl-title">导入 curl 命令</div>
            <textarea
              className="hc-curl-input"
              autoFocus
              value={curlText}
              onChange={(e) => { setCurlText(e.target.value); setCurlErr(""); }}
              placeholder={"curl 'https://api.example.com/users' \\\n  -H 'Authorization: Bearer token' \\\n  -d '{\"name\":\"test\"}'"}
              spellCheck={false}
            />
            {curlErr && <div className="hc-curl-err">{curlErr}</div>}
            <div className="hc-curl-actions">
              <button className="hc-send" onClick={importCurl} disabled={!curlText.trim()}>导入</button>
              <button onClick={() => setCurlOpen(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
      <div className="hc-bar">
        <select
          className="hc-method"
          value={method}
          onChange={(e) => handleMethodChange(e.target.value as Method)}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <div className="hc-url-wrap">
          <BuiltinInput
            className="hc-url"
            value={url}
            onChange={(v) => {
              if (v.trimStart().startsWith("curl ")) {
                applyCurl(v);
              } else {
                setUrl(v);
              }
            }}
            onBlur={() => syncParamsFromUrl(url)}
            placeholder="https://api.example.com/path  （{{ 插入变量，粘贴 curl 导入）"
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          {urlHistory.length > 0 && (
            <datalist id="hc-url-history">
              {urlHistory.map((u) => <option key={u} value={u} />)}
            </datalist>
          )}
        </div>
        <select
          className="hc-env-select"
          value={activeId}
          onChange={(e) => setActive(e.target.value)}
          title={activeEnv ? `当前环境：${activeEnv.name}` : "未选择环境"}
        >
          <option value="">无环境</option>
          {envs.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <button className="hc-curl-btn" onClick={() => setCurlOpen(true)} title="从 curl 命令导入">导入 curl</button>
        <button className="hc-curl-btn" onClick={() => copyText(buildCurl(method, url, headers, body), "curl 已复制")} title="导出为 curl 命令">导出 curl</button>
        <button className={`hc-curl-btn ${showRef ? "active" : ""}`} onClick={() => setShowRef((v) => !v)} title="内置函数参考">{"{{}}"}
        </button>
        <button className={`hc-curl-btn ${showFavs ? "active" : ""}`} onClick={() => setShowFavs((v) => !v)} title="收藏夹">★ 收藏</button>
        <button className="hc-send" onClick={send} disabled={busy}>
          {busy ? "发送中…" : "发送"}
        </button>
        {busy && (
          <button className="hc-curl-btn hc-abort-btn" onClick={() => { abortRef.current?.abort(); }} title="中止请求">
            ⏹ 中止
          </button>
        )}
        <select className="hc-timeout-sel" value={timeoutMs} onChange={(e) => setTimeoutMs(Number(e.target.value))} title="请求超时">
          <option value={5000}>5s</option>
          <option value={10000}>10s</option>
          <option value={30000}>30s</option>
          <option value={60000}>60s</option>
          <option value={120000}>120s</option>
        </select>
        <button className="hc-curl-btn" onClick={send} disabled={busy || !url.trim()} title="用相同参数重新发送">
          ↻ 重发
        </button>
      </div>

      <div className="hc-tabs">
        <button className={tab === "headers" ? "active" : ""} onClick={() => setTab("headers")}>请求头</button>
        <button className={tab === "query" ? "active" : ""} onClick={() => setTab("query")}>
          查询参数{params.filter(p => p.key.trim()).length > 0 && <span className="hc-badge">{params.filter(p => p.key.trim()).length}</span>}
        </button>
        <button className={tab === "body" ? "active" : ""} onClick={() => setTab("body")}>
          请求体{bodyHasContent && <span className="hc-badge">●</span>}
        </button>
        <button className={tab === "vars" ? "active" : ""} onClick={() => setTab("vars")}>
          变量{varsCount > 0 && <span className="hc-badge">{varsCount}</span>}
          {activeEnv && <span className="hc-badge hc-badge-env" title={`环境变量来自「${activeEnv.name}」`}>Env</span>}
        </button>
        <button className={tab === "auth" ? "active" : ""} onClick={() => setTab("auth")}>认证</button>
      </div>

      {showFavs && (
        <div className="hc-favs-panel">
          <div className="hc-favs-head">
            <span className="hc-favs-title">收藏夹</span>
            <input className="hc-fav-name" value={favName} onChange={(e) => setFavName(e.target.value)} placeholder="名称（留空用URL）" />
            <input className="hc-fav-group" value={favGroup} onChange={(e) => setFavGroup(e.target.value)} placeholder="分组" />
            <button className="hc-send" onClick={saveFav} disabled={!url.trim()}>+ 收藏当前</button>
          </div>
          <div className="hc-favs-list">
            {favs.length === 0 ? (
              <div className="hc-favs-empty">暂无收藏请求</div>
            ) : (
              [...favs].reverse().map((f) => (
                <div key={f.id} className="hc-fav-item" onClick={() => loadFav(f)}>
                  <span className={`hc-fav-method hc-method-${f.method.toLowerCase()}`}>{f.method}</span>
                  <span className="hc-fav-name-text">{f.name}</span>
                  {f.group && <span className="hc-fav-group-tag">{f.group}</span>}
                  <button className="hc-fav-del" onClick={(e) => { e.stopPropagation(); deleteFav(f.id); }}>×</button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {showRef && (
        <div className="hc-ref">
          <div className="hc-ref-title">内置函数（在 URL / 头值 / 请求体中使用，发送时自动替换）</div>
          <div className="hc-ref-grid">
            {BUILTIN_FNS.map((f) => (
              <div key={f.name} className="hc-ref-item">
                <code className="hc-ref-syntax" title="点击复制" onClick={() => copyText(f.syntax)}>{f.syntax}</code>
                <span className="hc-ref-desc">{f.desc}</span>
                <span className="hc-ref-eg">例：{f.example}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="hc-editor">
        {tab === "headers" && (
          <div className="hc-headers">
            {headers.map((h, i) => (
              <div key={i} className="hc-header-row">
                <input list="hc-common-headers" placeholder="Header" value={h.key} onChange={(e) => setHeader(i, { key: e.target.value })} />
                <BuiltinInput placeholder="Value（{{ 插入内置函数）" value={h.value} onChange={(v) => setHeader(i, { value: v })} onKeyDown={(e) => headerKeyDown(e, i, "value")} />
                <button onClick={() => removeHeader(i)}>×</button>
              </div>
            ))}
            <button className="hc-add" onClick={addHeader}>+ 添加请求头</button>
          </div>
        )}
        {tab === "query" && (
          <div className="hc-headers">
            {params.map((p, i) => (
              <div key={i} className="hc-header-row">
                <input placeholder="参数名" value={p.key} onChange={(e) => setParam(i, { key: e.target.value })} />
                <input placeholder="值" value={p.value} onChange={(e) => setParam(i, { value: e.target.value })} />
                <button onClick={() => removeParam(i)}>×</button>
              </div>
            ))}
            <button className="hc-add" onClick={addParam}>+ 添加参数</button>
          </div>
        )}
        {tab === "body" && (
          <div className="hc-body-wrap">
            <div className="hc-body-type-bar">
              <button className={bodyType === "raw" ? "active" : ""} onClick={() => setBodyType("raw")}>raw</button>
              <button className={bodyType === "graphql" ? "active" : ""} onClick={() => setBodyType("graphql")}>GraphQL</button>
              <button className={bodyType === "form-data" ? "active" : ""} onClick={() => setBodyType("form-data")}>form-data</button>
              <button className={bodyType === "urlencoded" ? "active" : ""} onClick={() => setBodyType("urlencoded")}>urlencoded</button>
            </div>
            {bodyType === "raw" && (
              <BuiltinInput multiline className="hc-body" value={body} onChange={setBody}
                placeholder={'请求体，如 {"name":"value"} （输入 {{ 插入内置函数）'} />
            )}
            {bodyType === "graphql" && (
              <div className="hc-gql-wrap">
                <textarea
                  className="hc-gql-query"
                  value={gqlQuery}
                  onChange={(e) => setGqlQuery(e.target.value)}
                  placeholder={"query GetUser($id: ID!) {\n  user(id: $id) {\n    id\n    name\n  }\n}"}
                  spellCheck={false}
                />
                <textarea
                  className="hc-gql-vars"
                  value={gqlVars}
                  onChange={(e) => setGqlVars(e.target.value)}
                  placeholder={'{\n  "id": "123"\n}'}
                  spellCheck={false}
                />
              </div>
            )}
            {(bodyType === "form-data" || bodyType === "urlencoded") && (
              <div className="hc-headers">
                {formFields.map((f, i) => (
                  <div key={i} className="hc-form-row">
                    <input
                      placeholder="字段名"
                      value={f.key}
                      onChange={(e) => setFormField(i, { key: e.target.value })}
                    />
                    {bodyType === "form-data" && (
                      <select
                        className="hc-field-type"
                        value={f.valueType}
                        onChange={(e) => setFormField(i, { valueType: e.target.value as "text" | "file", value: "", fileData: undefined, fileName: undefined })}
                      >
                        <option value="text">文本</option>
                        <option value="file">文件</option>
                      </select>
                    )}
                    {f.valueType === "file" ? (
                      <button
                        className="hc-file-btn"
                        onClick={() => pickFile(i)}
                        title={f.fileName || "选择文件"}
                      >
                        {f.fileName ? `📎 ${f.fileName}` : "选择文件…"}
                      </button>
                    ) : (
                      <input
                        placeholder="值"
                        value={f.value}
                        onChange={(e) => setFormField(i, { value: e.target.value })}
                      />
                    )}
                    <button onClick={() => removeFormField(i)}>×</button>
                  </div>
                ))}
                <button className="hc-add" onClick={addFormField}>+ 添加字段</button>
              </div>
            )}
          </div>
        )}
        {tab === "vars" && (
          <div className="hc-headers">
            {activeEnv && (
              <div className="hc-env-hint">
                <span className="hc-env-hint-label">环境变量（来自「{activeEnv.name}」，只读）：</span>
                {activeVars.length > 0 ? (
                  <div className="hc-env-vars">
                    {activeVars.map((v, i) => (
                      <span key={i} className="hc-env-var-chip" title={`${v.key} = ${v.value}`}>
                        <code>{v.key}</code>
                      </span>
                    ))}
                  </div>
                ) : <span className="hc-env-hint-empty">环境无变量</span>}
              </div>
            )}
            <div className="hc-vars-local-label">本地变量（可覆盖同名环境变量）：</div>
            {vars.map((v, i) => (
              <div key={i} className="hc-header-row">
                <input placeholder="变量名" value={v.key} onChange={(e) => setVar(i, { key: e.target.value })} />
                <input placeholder="值" value={v.value} onChange={(e) => setVar(i, { value: e.target.value })} />
                <button onClick={() => removeVar(i)}>×</button>
              </div>
            ))}
            <button className="hc-add" onClick={addVar}>+ 添加变量</button>
          </div>
        )}
        {tab === "auth" && (
          <div className="hc-headers">
            <div className="hc-auth-row">
              <select className="hc-auth-select" value={authType} onChange={(e) => setAuthType(e.target.value as typeof authType)}>
                <option value="none">无认证</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
                <option value="apikey">API Key</option>
              </select>
              {authType === "bearer" && (
                <input style={{ flex: 1 }} placeholder="Token" value={authVal} onChange={(e) => setAuthVal(e.target.value)} />
              )}
              {authType === "basic" && (
                <>
                  <input style={{ flex: 1 }} placeholder="用户名" value={authUser} onChange={(e) => setAuthUser(e.target.value)} />
                  <input style={{ flex: 1 }} placeholder="密码" type="password" value={authPass} onChange={(e) => setAuthPass(e.target.value)} />
                </>
              )}
              {authType === "apikey" && (
                <>
                  <input style={{ flex: 1 }} placeholder="Header 名称" value={authKey} onChange={(e) => setAuthKey(e.target.value)} />
                  <input style={{ flex: 1 }} placeholder="API Key 值" value={authVal} onChange={(e) => setAuthVal(e.target.value)} />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <div className="hc-error">{error}</div>}

      {resp && (
        <div className="hc-resp">
          <div className="hc-resp-status">
            <span className={`hc-status ${statusClass}`}>{resp.status} {resp.statusText}</span>
            <span className="hc-time">{resp.timeMs} ms</span>
            <span className="hc-resp-size" title="响应体大小">{fmtBytes(resp.bodySize)}</span>
            <span className="hc-resp-tabs">
              <button className={respTab === "body" ? "active" : ""} onClick={() => setRespTab("body")}>响应体</button>
              <button className={respTab === "headers" ? "active" : ""} onClick={() => setRespTab("headers")}>响应头 ({resp.headers.length})</button>
            </span>
            {respTab === "headers" && (
              <input
                className="hc-resp-search"
                type="text"
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                placeholder="搜索响应头…"
                spellCheck={false}
              />
            )}
            {respTab === "body" && (
              <span className="hc-view-toggle">
                <button className={respView === "text" ? "active" : ""} onClick={() => setRespView("text")}>文本</button>
                <button className={respView === "tree" ? "active" : ""} onClick={() => setRespView("tree")}>树</button>
              </span>
            )}
            <button className="hc-copy" onClick={() => copyText(resp.body)}>复制</button>
            <button className="hc-copy" onClick={saveRespToFile} title="保存响应体到文件">💾 保存</button>
          </div>
          {respTab === "body"
            ? (() => {
                // Image preview
                if (resp.contentType.startsWith("image/")) {
                  const dataUrl = `data:${resp.contentType};base64,${btoa(unescape(encodeURIComponent(resp.body)))}`;
                  return (
                    <div className="hc-resp-image">
                      <img src={dataUrl} alt="响应图片" />
                    </div>
                  );
                }
                if (respView === "tree") {
                  try {
                    return <div className="hc-resp-tree"><JsonTree data={JSON.parse(resp.body)} /></div>;
                  } catch { /* fall through to text */ }
                }
                return <pre className="hc-resp-body">{resp.body || "（空响应体）"}</pre>;
              })()
            : <div className="hc-resp-headers">
                {resp.headers
                  .filter(([k]) => !headerSearch.trim() || k.toLowerCase().includes(headerSearch.toLowerCase()))
                  .map(([k, v], i) => (
                  <div key={i} className="hc-rh-row">
                    <span className="hc-rh-key">{k}</span>
                    <span className="hc-rh-val">{v}</span>
                  </div>
                ))}
              </div>
          }
        </div>
      )}
      <datalist id="hc-common-headers">
        {COMMON_HEADERS.map((h) => <option key={h} value={h} />)}
      </datalist>
      <NetworkPanel tool="http" />
    </div>
  );
}
