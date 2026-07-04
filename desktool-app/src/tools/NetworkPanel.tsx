import { useEffect, useState } from "react";
import { clearLog, useNetworkLog, loadPersistedLog, savePersistedLog, type NetEntry } from "./networkLog";
import { copyText } from "../useCopyFeedback";
import { saveTextWithDialog } from "../saveFile";
import "./NetworkPanel.css";

const STATUS_CLASS = (s?: number) =>
  !s ? "" : s < 200 ? "np-1xx" : s < 300 ? "np-2xx" : s < 400 ? "np-3xx" : "np-4xx";

function fmt(ms?: number) {
  if (ms == null) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("zh-CN", { hour12: false });
}

function truncate(s: string, n = 80) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function prettyJson(s?: string): string {
  if (!s) return "";
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
}

function buildHar(entries: NetEntry[]): string {
  const harEntries = entries.map(e => ({
    startedDateTime: new Date(e.startTime).toISOString(),
    time: e.duration ?? 0,
    request: {
      method: e.method ?? e.type.toUpperCase(),
      url: e.url,
      httpVersion: "HTTP/1.1",
      headers: Object.entries(e.reqHeaders ?? {}).map(([name, value]) => ({ name, value })),
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: -1,
      ...(e.reqBody ? { postData: { mimeType: "application/json", text: e.reqBody } } : {}),
    },
    response: {
      status: e.status ?? 0,
      statusText: e.statusText ?? "",
      httpVersion: "HTTP/1.1",
      headers: (e.resHeaders ?? []).map(([name, value]) => ({ name, value })),
      cookies: [],
      content: { size: -1, mimeType: "text/plain", text: e.resBody ?? "" },
      redirectURL: "",
      headersSize: -1,
      bodySize: -1,
    },
    cache: {},
    timings: { send: 0, wait: e.duration ?? 0, receive: 0 },
  }));
  return JSON.stringify({
    log: {
      version: "1.2",
      creator: { name: "DeskTool", version: "0.1.0" },
      entries: harEntries,
    },
  }, null, 2);
}

type Tab = "reqHeaders" | "reqBody" | "resHeaders" | "resBody";

function Detail({ e }: { e: NetEntry }) {
  const [tab, setTab] = useState<Tab>("resBody");
  const tabs: { id: Tab; label: string; badge?: number | string }[] = [
    { id: "resBody", label: "响应体" },
    { id: "resHeaders", label: "响应头", badge: e.resHeaders?.length },
    { id: "reqBody", label: "请求体" },
    { id: "reqHeaders", label: "请求头", badge: e.reqHeaders ? Object.keys(e.reqHeaders).length : undefined },
  ];

  const content = (() => {
    switch (tab) {
      case "resBody": return prettyJson(e.resBody ?? e.error);
      case "reqBody": return prettyJson(e.reqBody);
      case "resHeaders": return e.resHeaders?.map(([k, v]) => `${k}: ${v}`).join("\n") ?? "";
      case "reqHeaders": return Object.entries(e.reqHeaders ?? {}).map(([k, v]) => `${k}: ${v}`).join("\n");
    }
  })();

  return (
    <div className="np-detail">
      <div className="np-detail-tabs">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
            {t.label}{t.badge != null ? ` (${t.badge})` : ""}
          </button>
        ))}
        <button
          className="np-copy-btn"
          onClick={() => copyText(content)}
          disabled={!content}
        >
          复制
        </button>
      </div>
      <pre className="np-detail-body">{content || "（空）"}</pre>
    </div>
  );
}

interface Props { tool: string; }

export default function NetworkPanel({ tool }: Props) {
  const entries = useNetworkLog(tool);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [persist, setPersist] = useState(() => {
    try { return localStorage.getItem(`np:${tool}:persist`) === "true"; } catch { return false; }
  });
  const [savedEntries, setSavedEntries] = useState<NetEntry[]>(() => loadPersistedLog(tool));

  useEffect(() => {
    try { localStorage.setItem(`np:${tool}:persist`, String(persist)); } catch { }
  }, [persist, tool]);

  useEffect(() => {
    if (persist && entries.length > 0) {
      savePersistedLog(tool, entries);
      setSavedEntries(entries);
    }
  }, [entries, persist, tool]);

  const displayEntries = persist && entries.length === 0 ? savedEntries : entries;
  const sel = displayEntries.find((e) => e.id === selected) ?? null;

  return (
    <div className={`np-wrap ${open ? "np-open" : ""}`}>
      <div className="np-toggle" onClick={() => setOpen((v) => !v)}>
        <span className="np-toggle-icon">{open ? "▾" : "▸"}</span>
        <span>Network</span>
        {displayEntries.length > 0 && <span className="np-badge">{displayEntries.length}</span>}
        {displayEntries.some((e) => e.state === "error") && <span className="np-err-dot" />}
        <span className="np-spacer" />
        {open && (
          <>
            <label className="np-persist-label" onClick={e => e.stopPropagation()}>
              <input type="checkbox" checked={persist} onChange={e => setPersist(e.target.checked)} />
              持久化
            </label>
            <button className="np-har-btn" disabled={displayEntries.length === 0}
              onClick={e => { e.stopPropagation(); saveTextWithDialog(buildHar(displayEntries), "network.har"); }}>
              导出 HAR
            </button>
            <button className="np-clear" onClick={(e) => {
              e.stopPropagation();
              clearLog();
              setSelected(null);
              if (persist) { savePersistedLog(tool, []); setSavedEntries([]); }
            }}>
              清空
            </button>
          </>
        )}
      </div>

      {open && (
        <div className="np-body">
          <div className={`np-list ${sel ? "np-split" : ""}`}>
            {displayEntries.length === 0 ? (
              <div className="np-empty">暂无请求记录</div>
            ) : (
              displayEntries.map((e) => (
                <div
                  key={e.id}
                  className={`np-row ${selected === e.id ? "on" : ""} np-state-${e.state}`}
                  onClick={() => setSelected(selected === e.id ? null : e.id)}
                >
                  <span className="np-row-time">{fmtTime(e.startTime)}</span>
                  <span className="np-row-badge np-type">{e.type.toUpperCase()}</span>
                  {e.method && <span className="np-row-method">{e.method}</span>}
                  <span className={`np-row-status ${STATUS_CLASS(e.status)}`}>
                    {e.state === "pending" ? "…" : (e.status ?? (e.state === "error" ? "ERR" : "—"))}
                  </span>
                  <span className="np-row-url" title={e.url}>{truncate(e.url, 60)}</span>
                  <span className="np-row-dur">{fmt(e.duration)}</span>
                </div>
              ))
            )}
          </div>

          {sel && (
            <div className="np-detail-wrap">
              <div className="np-detail-url" title={sel.url}>
                <strong>{sel.method ?? sel.type.toUpperCase()}</strong> {sel.url}
              </div>
              <Detail e={sel} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
