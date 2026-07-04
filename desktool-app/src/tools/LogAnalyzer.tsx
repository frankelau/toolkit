import { useEffect, useMemo, useRef, useState } from "react";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText, toast } from "../useCopyFeedback";
import { openTextFile } from "../openFile";
import { saveTextWithDialog } from "../saveFile";
import "./LogAnalyzer.css";
import LineNumberedArea from "../components/LineNumberedArea";

type Level = "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE" | "OTHER";
const LEVELS: Level[] = ["ERROR", "WARN", "INFO", "DEBUG", "TRACE", "OTHER"];
const LEVEL_COLORS: Record<Level, string> = {
  ERROR: "#e5484d", WARN: "#f5a623", INFO: "#3b9eff",
  DEBUG: "#8e8e93", TRACE: "#b07cff", OTHER: "#7a7a7a",
};
const LEVEL_PATTERNS: { level: Level; re: RegExp }[] = [
  { level: "ERROR", re: /\b(ERROR|ERR|SEVERE|FATAL|CRITICAL|PANIC)\b/i },
  { level: "WARN",  re: /\b(WARN|WARNING)\b/i },
  { level: "INFO",  re: /\b(INFO|NOTICE)\b/i },
  { level: "DEBUG", re: /\b(DEBUG|FINE)\b/i },
  { level: "TRACE", re: /\b(TRACE|VERBOSE)\b/i },
];
const TS_RE = /(\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?)|(\b\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?\b)/;

const ROW_H = 26;
const OVERSCAN = 10;

interface LogLine { n: number; text: string; level: Level; ts?: string; jsonFields?: Record<string, unknown>; }

function detectLevel(line: string): Level {
  for (const { level, re } of LEVEL_PATTERNS) if (re.test(line)) return level;
  return "OTHER";
}
function parseTs(line: string) { const m = TS_RE.exec(line); return m ? (m[1] ?? m[2]) : undefined; }
function signature(line: string) {
  return line.replace(TS_RE, "").replace(/0x[0-9a-fA-F]+/g, "0x?")
    .replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, "<uuid>")
    .replace(/\b\d+\b/g, "#").replace(/\s+/g, " ").trim();
}

export default function LogAnalyzer({ instanceId }: ToolProps) {
  const ns = `log:${instanceId}`;
  const [raw, setRaw] = usePersistentState(`${ns}:raw`, "");
  const [query, setQuery] = usePersistentState(`${ns}:q`, "");
  const [useRegex, setUseRegex] = usePersistentState(`${ns}:re`, false);
  const [caseSensitive, setCaseSensitive] = usePersistentState(`${ns}:cs`, false);
  const [enabled, setEnabled] = usePersistentState<Record<Level, boolean>>(
    `${ns}:lv`, { ERROR: true, WARN: true, INFO: true, DEBUG: true, TRACE: true, OTHER: true },
  );
  const [view, setView] = usePersistentState<"lines" | "aggregate">(`${ns}:view`, "lines");
  const [wrap, setWrap] = usePersistentState(`${ns}:wrap`, false);
  const [tsFrom, setTsFrom] = usePersistentState(`${ns}:tsFrom`, "");
  const [tsTo, setTsTo] = usePersistentState(`${ns}:tsTo`, "");

  // 输入区高度（可拖拽调整）
  const [inputHeight, setInputHeight] = useState(140);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  // 行详情 & 右键菜单
  const [detailLine, setDetailLine] = useState<LogLine | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; line: LogLine } | null>(null);

  // 虚拟滚动
  const [scrollTop, setScrollTop] = useState(0);
  const [containerH, setContainerH] = useState(400);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setContainerH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── 拖拽 handle ──────────────────────────────────────────────
  function onHandleDown(e: React.MouseEvent) {
    dragRef.current = { startY: e.clientY, startH: inputHeight };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setInputHeight(Math.max(60, dragRef.current.startH + ev.clientY - dragRef.current.startY));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // ── 解析 ─────────────────────────────────────────────────────
  const lines = useMemo<LogLine[]>(() => {
    if (!raw) return [];
    return raw.split("\n").map((text, i) => {
      // 优化：仅对以 { 开头或以 } 结尾的行尝试 JSON 解析（跳过纯文本行）
      let jsonFields: Record<string, unknown> | undefined;
      const trimmed = text.trim();
      if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || trimmed.startsWith("[{")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (typeof parsed === "object" && parsed !== null) jsonFields = parsed as Record<string, unknown>;
        } catch { /* not valid JSON */ }
      }
      return { n: i + 1, text, level: detectLevel(text), ts: parseTs(text), ...(jsonFields ? { jsonFields } : {}) };
    });
  }, [raw]);

  const counts = useMemo(() => {
    const c: Record<Level, number> = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, TRACE: 0, OTHER: 0 };
    for (const l of lines) c[l.level]++;
    return c;
  }, [lines]);

  const timeSpan = useMemo(() => {
    const ts = lines.map((l) => l.ts).filter(Boolean) as string[];
    if (!ts.length) return null;
    return { first: ts[0], last: ts[ts.length - 1] };
  }, [lines]);

  const matcher = useMemo(() => {
    const q = query.trim();
    if (!q) return null;
    if (useRegex) {
      try { return { re: new RegExp(q, caseSensitive ? "g" : "gi"), error: false as const }; }
      catch (e) { return { error: true as const, msg: (e as Error).message }; }
    }
    return { re: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), caseSensitive ? "g" : "gi"), error: false as const };
  }, [query, useRegex, caseSensitive]);

  const filtered = useMemo(() => lines.filter((l) => {
    if (!enabled[l.level]) return false;
    if (matcher && !matcher.error) { matcher.re.lastIndex = 0; if (!matcher.re.test(l.text)) return false; }
    if (tsFrom && l.ts && l.ts < tsFrom) return false;
    if (tsTo && l.ts && l.ts > tsTo) return false;
    return true;
  }), [lines, enabled, matcher, tsFrom, tsTo]);

  const aggregated = useMemo(() => {
    const map = new Map<string, { count: number; sample: LogLine }>();
    for (const l of filtered) {
      if (l.level !== "ERROR" && l.level !== "WARN") continue;
      const sig = signature(l.text); if (!sig) continue;
      const hit = map.get(sig);
      if (hit) hit.count++; else map.set(sig, { count: 1, sample: l });
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [filtered]);

  function highlight(text: string) {
    if (!matcher || matcher.error) return text;
    const parts: React.ReactNode[] = [];
    let last = 0; matcher.re.lastIndex = 0; let m: RegExpExecArray | null; let g = 0;
    while ((m = matcher.re.exec(text)) !== null && g++ < 1000) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      parts.push(<mark key={`${m.index}-${g}`} className="log-hl">{m[0]}</mark>);
      last = m.index + m[0].length;
      if (!m[0].length) matcher.re.lastIndex++;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  }

  function openCtx(e: React.MouseEvent, l: LogLine) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, line: l });
  }

  async function openFile() {
    const res = await openTextFile();
    if (res?.text != null) setRaw(res.text);
  }

  async function exportOutput() {
    const text = filtered.length > 0 ? filtered.map((l) => l.text).join("\n") : raw;
    if (!text) return;
    const res = await saveTextWithDialog(text, "log.txt");
    if (res.saved) toast("已保存到 " + res.path, "success");
  }

  async function exportAggReport() {
    if (!aggregated.length) return;
    const lines2 = [
      `日志异常聚合报告`,
      `生成时间: ${new Date().toLocaleString("zh-CN")}`,
      `总行数: ${lines.length}，过滤后: ${filtered.length}，聚合条目: ${aggregated.length}`,
      "",
      ...aggregated.map((a, i) =>
        `[${i + 1}] 出现 ${a.count} 次 (${a.sample.level}):\n    ${a.sample.text}`
      ),
    ];
    const res = await saveTextWithDialog(lines2.join("\n"), "log-report.txt");
    if (res.saved) toast("已保存到 " + res.path, "success");
  }

  const total = lines.length;
  const errPct = total ? ((counts.ERROR / total) * 100).toFixed(1) : "0";

  return (
    <div className="log-tool" onClick={() => setCtxMenu(null)}>
      {/* ── 输入区（高度可拖拽）── */}
      <LineNumberedArea
        className="log-input"
        style={{ height: inputHeight, flex: "none" }}
        value={raw}
        onChange={setRaw}
        placeholder="把系统打印的日志粘贴到这里…"
        spellCheck={false}
      />
      <div className="log-resize-handle" onMouseDown={onHandleDown} />

      {/* ── 统计面板 ── */}
      <div className="log-stats">
        <div className="log-stat"><span className="log-stat-num">{total}</span><span className="log-stat-label">总行数</span></div>
        {LEVELS.map((lv) => counts[lv] > 0 ? (
          <div key={lv} className="log-stat">
            <span className="log-stat-num" style={{ color: LEVEL_COLORS[lv] }}>{counts[lv]}</span>
            <span className="log-stat-label">{lv}</span>
          </div>
        ) : null)}
        <div className="log-stat">
          <span className="log-stat-num" style={{ color: LEVEL_COLORS.ERROR }}>{errPct}%</span>
          <span className="log-stat-label">错误占比</span>
        </div>
        {timeSpan && (
          <div className="log-stat log-stat-span" title={`${timeSpan.first} → ${timeSpan.last}`}>
            <span className="log-stat-num-sm">{timeSpan.first} → {timeSpan.last}</span>
            <span className="log-stat-label">时间跨度</span>
          </div>
        )}
      </div>

      {/* ── 工具栏 ── */}
      <div className="log-toolbar">
        <div className="log-levels">
          {LEVELS.map((lv) => (counts[lv] > 0 || lv === "ERROR" || lv === "WARN" || lv === "INFO") ? (
            <button key={lv} className={`log-level-btn ${enabled[lv] ? "on" : ""}`}
              style={enabled[lv] ? { borderColor: LEVEL_COLORS[lv], color: LEVEL_COLORS[lv] } : undefined}
              onClick={() => setEnabled((p) => ({ ...p, [lv]: !p[lv] }))}>
              {lv}
            </button>
          ) : null)}
        </div>
        <span className="log-spacer" />
        <input className="log-search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder={useRegex ? "正则搜索…" : "关键字搜索…"} />
        <label className="log-check"><input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} />正则</label>
        <label className="log-check"><input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />区分大小写</label>
        <span className="log-tr-sep" />
        <label className="log-ts-label">从</label>
        <input className="log-ts-input" type="text" value={tsFrom} onChange={(e) => setTsFrom(e.target.value)} placeholder="2024-01-01 00:00:00" title="起始时间 (支持前缀匹配)" />
        <label className="log-ts-label">至</label>
        <input className="log-ts-input" type="text" value={tsTo} onChange={(e) => setTsTo(e.target.value)} placeholder="2024-12-31 23:59:59" title="结束时间" />
        {(tsFrom || tsTo) && <button onClick={() => { setTsFrom(""); setTsTo(""); }} title="清除时间范围">× 时间</button>}
      </div>

      {matcher?.error && <div className="log-err">正则错误：{matcher.msg}</div>}

      {/* ── 视图切换 ── */}
      <div className="log-subbar">
        <div className="log-tabs">
          <button className={view === "lines" ? "on" : ""} onClick={() => setView("lines")}>日志行 ({filtered.length})</button>
          <button className={view === "aggregate" ? "on" : ""} onClick={() => setView("aggregate")}>异常聚合 ({aggregated.length})</button>
        </div>
        <span className="log-spacer" />
        <label className="log-check"><input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} />自动换行</label>
        <button onClick={openFile} title="打开文件">📁 打开</button>
        <button onClick={exportOutput} disabled={!raw}>💾 导出</button>
        <button onClick={exportAggReport} disabled={aggregated.length === 0}>导出聚合报告</button>
        <button onClick={() => copyText(filtered.map((l) => l.text).join("\n"))} disabled={filtered.length === 0}>复制结果</button>
        <button onClick={() => { setRaw(""); setQuery(""); }} disabled={!raw}>清空</button>
      </div>

      {/* ── 结果区 ── */}
      <div className="log-output">
        {total === 0 ? (
          <div className="log-empty">粘贴日志后，这里显示分析结果</div>
        ) : view === "lines" ? (
          /* wrap=true 时行高不固定，降级为普通渲染；否则启用虚拟滚动 */
          <div
            ref={listRef}
            className={`log-lines ${wrap ? "wrap" : ""}`}
            onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
          >
            {wrap ? (
              filtered.length === 0
                ? <div className="log-empty">没有匹配当前过滤条件的行</div>
                : filtered.map((l) => (
                    <div key={l.n} className="log-line"
                      onDoubleClick={() => setDetailLine(l)}
                      onContextMenu={(e) => openCtx(e, l)}>
                      <span className="log-ln">{l.n}</span>
                      <span className="log-badge" style={{ background: LEVEL_COLORS[l.level] }}>{l.level}</span>
                      <span className="log-text">{highlight(l.text)}</span>
                    </div>
                  ))
            ) : (
              filtered.length === 0
                ? <div className="log-empty">没有匹配当前过滤条件的行</div>
                : (() => {
                    const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
                    const end = Math.min(filtered.length, Math.ceil((scrollTop + containerH) / ROW_H) + OVERSCAN);
                    return (
                      <div style={{ height: filtered.length * ROW_H, position: "relative" }}>
                        {filtered.slice(start, end).map((l, ri) => (
                          <div
                            key={l.n}
                            className="log-line"
                            style={{ position: "absolute", top: (start + ri) * ROW_H, left: 0, right: 0, height: ROW_H }}
                            onDoubleClick={() => setDetailLine(l)}
                            onContextMenu={(e) => openCtx(e, l)}
                          >
                            <span className="log-ln">{l.n}</span>
                            <span className="log-badge" style={{ background: LEVEL_COLORS[l.level] }}>{l.level}</span>
                            <span className="log-text">{highlight(l.text)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()
            )}
          </div>
        ) : (
          <div className="log-agg">
            {aggregated.length === 0
              ? <div className="log-empty">没有可聚合的 ERROR / WARN 行</div>
              : aggregated.map((a, i) => (
                <div key={i} className="log-agg-row"
                  onDoubleClick={() => setDetailLine(a.sample)}
                  onContextMenu={(e) => openCtx(e, a.sample)}>
                  <span className="log-agg-count" style={{ background: LEVEL_COLORS[a.sample.level] }}>×{a.count}</span>
                  <span className="log-agg-text">{a.sample.text}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ── 右键菜单 ── */}
      {ctxMenu && (
        <div className="log-ctx" style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={(e) => e.stopPropagation()}>
          <div className="log-ctx-item" onClick={() => { setDetailLine(ctxMenu.line); setCtxMenu(null); }}>🔍 查看详情</div>
          <div className="log-ctx-item" onClick={() => { copyText(ctxMenu.line.text); setCtxMenu(null); }}>📋 复制此行</div>
        </div>
      )}

      {/* ── 行详情浮层 ── */}
      {detailLine && (
        <div className="log-detail-overlay" onClick={() => setDetailLine(null)}>
          <div className="log-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="log-detail-head">
              <span className="log-badge" style={{ background: LEVEL_COLORS[detailLine.level] }}>{detailLine.level}</span>
              <span className="log-detail-ln">第 {detailLine.n} 行</span>
              {detailLine.ts && <span className="log-detail-ts">{detailLine.ts}</span>}
              <span className="log-spacer" />
              <button onClick={() => copyText(detailLine.text)}>复制</button>
              <button className="log-detail-close" onClick={() => setDetailLine(null)}>✕</button>
            </div>
            <pre className="log-detail-body">{detailLine.text}</pre>
            {detailLine.jsonFields && (
              <div className="log-detail-json">
                <div className="log-detail-json-title">JSON 字段：</div>
                <pre className="log-detail-json-body">{JSON.stringify(detailLine.jsonFields, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
