import { useMemo, useState, useRef, useEffect } from "react";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText } from "../useCopyFeedback";
import {
  parseSse, getByPath, asText, assemble, assembleWithRules, extractItemText,
  newRule, type SseEvent, type ExtractRule, type StreamItem,
} from "./streamParse";
import RulesEditor, { type PathPreset } from "./RulesEditor";
import { useResizable } from "./useResizable";
import "./StreamAnalyzer.css";
import LineNumberedArea from "../components/LineNumberedArea";
import DropZone from "../components/DropZone";
import { saveTextWithDialog } from "../saveFile";
import { openTextFile } from "../openFile";

const PATH_PRESETS: PathPreset[] = [
  { label: "OpenAI delta", path: "choices/0/delta/content" },
  { label: "Claude delta", path: "delta/text" },
  { label: "OpenAI 完整", path: "choices/0/message/content" },
  { label: "事件名 $event", path: "$event" },
  { label: "data 原文", path: "" },
];

function toItem(e: SseEvent): StreamItem {
  return { json: e.json, text: e.data, event: e.event ?? "message" };
}

export default function SseAnalyzer({ instanceId }: ToolProps) {
  const ns = `sse:${instanceId}`;
  const [raw, setRaw] = usePersistentState(`${ns}:raw`, "");
  const [path, setPath] = usePersistentState(`${ns}:path`, "choices/0/delta/content");
  const [mode, setMode] = usePersistentState<"simple" | "rules">(`${ns}:mode`, "simple");
  const [rules, setRules] = usePersistentState<ExtractRule[]>(`${ns}:rules`, [
    { ...newRule("choices/0/delta/content"), id: "r0" },
  ]);
  const [query, setQuery] = usePersistentState(`${ns}:q`, "");
  const [view, setView] = usePersistentState<"events" | "assembled" | "types">(`${ns}:view`, "assembled");
  const [showRaw, setShowRaw] = usePersistentState(`${ns}:showraw`, false);
  const [detail, setDetail] = useState<SseEvent | null>(null);
  const { height, onHandleDown } = useResizable();

  // Rule presets
  const [rulePresets, setRulePresets] = usePersistentState<{ name: string; rules: ExtractRule[] }[]>(`${ns}:rulePresets`, []);
  const [presetSel, setPresetSel] = usePersistentState(`${ns}:presetSel`, "");

  // Live mode
  const [source, setSource] = usePersistentState<"paste" | "live">(`${ns}:source`, "paste");
  const [liveUrl, setLiveUrl] = usePersistentState(`${ns}:liveUrl`, "");
  const [liveStatus, setLiveStatus] = useState<"disconnected" | "connected">("disconnected");
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => () => { esRef.current?.close(); }, []);

  function connectLive() {
    if (!liveUrl.trim()) return;
    const es = new EventSource(liveUrl.trim());
    esRef.current = es;
    es.onopen = () => setLiveStatus("connected");
    es.onerror = () => { setLiveStatus("disconnected"); es.close(); esRef.current = null; };
    es.onmessage = (e) => setRaw(r => r + "\ndata: " + e.data);
    es.addEventListener("message", () => {});
  }

  function disconnectLive() {
    esRef.current?.close();
    esRef.current = null;
    setLiveStatus("disconnected");
  }

  const events = useMemo(() => parseSse(raw), [raw]);
  const items = useMemo(() => events.map(toItem), [events]);

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) {
      const k = e.event ?? "message";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);

  const jsonCount = useMemo(() => events.filter((e) => e.json !== undefined).length, [events]);
  const assembled = useMemo(
    () => (mode === "rules" ? assembleWithRules(items, rules) : assemble(events, path)),
    [mode, items, rules, events, path],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) =>
      (e.event ?? "message").toLowerCase().includes(q) || e.data.toLowerCase().includes(q));
  }, [events, query]);

  const renderEvents = filtered.length > 1000 ? filtered.slice(0, 1000) : filtered;

  function shownValue(e: SseEvent): string | undefined {
    if (mode === "rules") return extractItemText(toItem(e), rules);
    return path ? (() => { const v = getByPath(e.json, path); return v === undefined ? undefined : asText(v); })() : undefined;
  }

  return (
    <div className="sa-tool">
      <div className="sa-source-bar">
        <button className={source === "paste" ? "on" : ""} onClick={() => setSource("paste")}>粘贴</button>
        <button className={source === "live" ? "on" : ""} onClick={() => setSource("live")}>实时</button>
      </div>

      {source === "paste" ? (
        <DropZone onText={(_, text) => setRaw(text)} accept=".txt,.log,.sse">
          <LineNumberedArea
            className="sa-input"
            style={{ height }}
            value={raw}
            onChange={setRaw}
            placeholder={"把 SSE 响应整段粘贴到这里…\n例：\nevent: message\ndata: {\"choices\":[{\"delta\":{\"content\":\"你\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"好\"}}]}"}
            spellCheck={false}
          />
        </DropZone>
      ) : (
        <div className="sa-live-bar">
          <input className="sa-live-url" value={liveUrl} onChange={e => setLiveUrl(e.target.value)} placeholder="SSE 地址" />
          {liveStatus === "disconnected"
            ? <button onClick={connectLive}>连接</button>
            : <button onClick={disconnectLive}>断开</button>}
          <span className={`sa-live-dot ${liveStatus}`} />
          <button onClick={() => setRaw("")}>清空</button>
        </div>
      )}

      <div className="sa-resize-handle" onMouseDown={onHandleDown} />

      <div className="sa-stats">
        <div className="sa-stat"><span className="sa-num">{events.length}</span><span className="sa-label">事件数</span></div>
        <div className="sa-stat"><span className="sa-num">{jsonCount}</span><span className="sa-label">JSON 块</span></div>
        <div className="sa-stat"><span className="sa-num">{typeCounts.length}</span><span className="sa-label">事件类型</span></div>
        <div className="sa-stat"><span className="sa-num">{assembled.length}</span><span className="sa-label">拼接字符</span></div>
      </div>

      <div className="sa-pathbar">
        <div className="sa-mode">
          <button className={mode === "simple" ? "on" : ""} onClick={() => setMode("simple")}>简单路径</button>
          <button className={mode === "rules" ? "on" : ""} onClick={() => setMode("rules")}>高级规则</button>
        </div>
        {mode === "simple" ? (
          <>
            <span className="sa-path-label">抽取路径</span>
            <input
              className="sa-path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="如 choices/0/delta/content（空 = data 原文）"
              spellCheck={false}
            />
            <select className="sa-preset" value="" onChange={(e) => e.target.value !== "" && setPath(e.target.value)}>
              <option value="">预设…</option>
              {PATH_PRESETS.map((p) => <option key={p.label} value={p.path}>{p.label}</option>)}
            </select>
          </>
        ) : (
          <span className="sa-mode-hint">多条规则：先过滤后拼接、按不同条件抽不同字段</span>
        )}
      </div>

      {mode === "rules" && <RulesEditor rules={rules} onChange={setRules} presets={PATH_PRESETS} />}
      {mode === "rules" && (
        <div className="sa-preset-bar">
          <select value={presetSel} onChange={e => {
            setPresetSel(e.target.value);
            const p = rulePresets.find(p => p.name === e.target.value);
            if (p) setRules(p.rules);
          }}>
            <option value="">加载预设...</option>
            {rulePresets.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <button onClick={() => {
            const name = window.prompt("预设名称");
            if (!name) return;
            setRulePresets(ps => { const out = ps.filter(p => p.name !== name); return [...out, { name, rules }]; });
            setPresetSel(name);
          }}>保存当前</button>
          <button onClick={() => {
            if (!presetSel) return;
            setRulePresets(ps => ps.filter(p => p.name !== presetSel));
            setPresetSel("");
          }} disabled={!presetSel}>删除</button>
          <button onClick={() => saveTextWithDialog(JSON.stringify(rulePresets, null, 2), "rule-presets.json")}>导出 JSON</button>
          <button onClick={async () => {
            const f = await openTextFile();
            if (!f?.text) return;
            try {
              const imported = JSON.parse(f.text) as { name: string; rules: ExtractRule[] }[];
              setRulePresets(ps => {
                const m = new Map(ps.map(p => [p.name, p]));
                for (const p of imported) m.set(p.name, p);
                return [...m.values()];
              });
            } catch { /* ignore bad JSON */ }
          }}>导入 JSON</button>
        </div>
      )}

      <div className="sa-subbar">
        <div className="sa-tabs">
          <button className={view === "assembled" ? "on" : ""} onClick={() => setView("assembled")}>拼接结果</button>
          <button className={view === "events" ? "on" : ""} onClick={() => setView("events")}>事件列表 ({filtered.length})</button>
          <button className={view === "types" ? "on" : ""} onClick={() => setView("types")}>类型统计 ({typeCounts.length})</button>
        </div>
        <span className="sa-spacer" />
        {view === "events" && (
          <>
            <input className="sa-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索事件…" />
            <label className="sa-check" title="切换：抽取转换后的值 / 原始 data 文本">
              <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />显示原文
            </label>
          </>
        )}
        {view === "assembled"
          ? <button onClick={() => copyText(assembled)} disabled={!assembled}>复制</button>
          : null}
        <button onClick={() => { setRaw(""); setQuery(""); }} disabled={!raw}>清空</button>
      </div>

      <div className="sa-output">
        {events.length === 0 ? (
          <div className="sa-empty">粘贴 SSE 响应后，这里显示解析结果</div>
        ) : view === "assembled" ? (
          assembled
            ? <pre className="sa-assembled">{assembled}</pre>
            : <div className="sa-empty">{mode === "rules" ? "当前规则没抽到内容，检查条件/路径或看「事件列表」确认结构" : <>路径 <code>{path || "(空)"}</code> 没抽到内容，换个路径或看「事件列表」确认结构</>}</div>
        ) : view === "types" ? (
          <div className="sa-types">
            {typeCounts.map(([t, c]) => (
              <div key={t} className="sa-type-row">
                <span className="sa-type-name">{t}</span>
                <span className="sa-type-count">×{c}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="sa-events">
            {renderEvents.length === 0
              ? <div className="sa-empty">没有匹配的事件</div>
              : renderEvents.map((e) => {
                const val = showRaw ? undefined : shownValue(e);
                const transformed = !showRaw && val !== undefined;
                return (
                  <div key={e.n} className="sa-event" onDoubleClick={() => setDetail(e)}>
                    <span className="sa-ev-n">{e.n}</span>
                    <span className={`sa-ev-type ${e.json ? "json" : ""}`}>{e.event ?? "message"}</span>
                    {e.id && <span className="sa-ev-id">id={e.id}</span>}
                    <span className="sa-ev-data">
                      {transformed
                        ? <span className="sa-ev-extract">{val}</span>
                        : (e.comment != null && !e.data ? <span className="sa-ev-comment">: {e.comment}</span> : e.data)}
                    </span>
                  </div>
                );
              })}
            {filtered.length > 1000 && (
              <div className="sa-list-cap">仅显示前 1000 条（共 {filtered.length} 条），使用搜索筛选</div>
            )}
          </div>
        )}
      </div>

      {detail && (
        <div className="sa-overlay" onClick={() => setDetail(null)}>
          <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-head">
              <span className={`sa-ev-type ${detail.json ? "json" : ""}`}>{detail.event ?? "message"}</span>
              <span className="sa-modal-n">第 {detail.n} 条</span>
              {detail.id && <span className="sa-ev-id">id={detail.id}</span>}
              {detail.retry != null && <span className="sa-ev-id">retry={detail.retry}</span>}
              <span className="sa-spacer" />
              <button onClick={() => copyText(detail.data)}>复制 data</button>
              <button className="sa-close" onClick={() => setDetail(null)}>✕</button>
            </div>
            <pre className="sa-modal-body">
              {detail.json !== undefined ? JSON.stringify(detail.json, null, 2) : (detail.data || detail.comment || "(空)")}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
