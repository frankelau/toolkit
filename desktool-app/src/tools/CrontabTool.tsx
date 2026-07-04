import { useMemo } from "react";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText } from "../useCopyFeedback";
import "./CrontabTool.css";

const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *", "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *", "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *", "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

const FIELDS_5 = [
  { key: "min", label: "分钟", desc: "0-59" },
  { key: "hour", label: "小时", desc: "0-23" },
  { key: "dom", label: "日", desc: "1-31" },
  { key: "mon", label: "月", desc: "1-12" },
  { key: "dow", label: "周", desc: "0-6" },
] as const;

const FIELDS_6 = [
  { key: "sec", label: "秒", desc: "0-59" },
  ...FIELDS_5,
] as const;

const PRESETS = [
  { label: "每分钟", expr: "* * * * *" },
  { label: "每 5 分钟", expr: "*/5 * * * *" },
  { label: "每小时整点", expr: "0 * * * *" },
  { label: "每天午夜", expr: "0 0 * * *" },
  { label: "每天 9 点", expr: "0 9 * * *" },
  { label: "每周一 9 点", expr: "0 9 * * 1" },
  { label: "每月 1 号", expr: "0 0 1 * *" },
  { label: "工作日 18 点", expr: "0 18 * * 1-5" },
];

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const DOWS = ["日","一","二","三","四","五","六"];

interface ParsedField { values: number[]; isAll: boolean; }

/** 解析单个 cron 字段为命中的数值集合 */
function parseField(raw: string, min: number, max: number, names?: string[]): ParsedField | null {
  let f = raw.trim().toUpperCase();
  if (names) names.forEach((n, i) => { f = f.replace(new RegExp(n, "g"), String(i + (min === 1 ? 1 : 0))); });
  if (f === "*" || f === "?") return { values: range(min, max), isAll: true };
  const values = new Set<number>();
  for (const part of f.split(",")) {
    const stepM = part.split("/");
    const step = stepM[1] ? parseInt(stepM[1], 10) : 1;
    if (!step || step < 1) return null;
    const base = stepM[0];
    let lo = min, hi = max;
    if (base !== "*") {
      const rangeM = base.split("-");
      lo = parseInt(rangeM[0], 10);
      hi = rangeM[1] ? parseInt(rangeM[1], 10) : (stepM[1] ? max : lo);
      if (Number.isNaN(lo) || Number.isNaN(hi)) return null;
    }
    if (lo < min || hi > max || lo > hi) return null;
    for (let v = lo; v <= hi; v += step) values.add(v);
  }
  return { values: [...values].sort((a, b) => a - b), isAll: false };
}

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

/** 计算接下来 N 次执行时间 */
function nextRuns(fields: ParsedField[], count: number): Date[] {
  const [mins, hours, doms, mons, dows] = fields;
  const runs: Date[] = [];
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  let guard = 0;
  while (runs.length < count && guard++ < 500000) {
    const matchDom = doms.isAll, matchDow = dows.isAll;
    const domOk = doms.values.includes(d.getDate());
    const dowOk = dows.values.includes(d.getDay());
    const dayOk = (matchDom && matchDow) ? true
      : (!matchDom && !matchDow) ? (domOk || dowOk)
      : (matchDom ? dowOk : domOk);
    if (mins.values.includes(d.getMinutes()) &&
        hours.values.includes(d.getHours()) &&
        mons.values.includes(d.getMonth() + 1) &&
        dayOk) {
      runs.push(new Date(d));
    }
    d.setMinutes(d.getMinutes() + 1);
  }
  return runs;
}

function describe(parts: string[]): string {
  if (parts.length < 5) return "";
  const offset = parts.length === 6 ? 1 : 0;
  const [mi, h, dom, mon, dow] = parts.slice(offset);
  const parts2: string[] = [];

  if (mon !== "*") {
    const mNames = ["","一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"];
    const mNum = parseInt(mon);
    parts2.push(isNaN(mNum) ? `${mon} 月` : (mNames[mNum] ?? `${mon} 月`));
  }
  if (dom !== "*" && dow === "*") parts2.push(`每月 ${dom} 日`);
  else if (dow !== "*" && dom === "*") {
    const dowNames: Record<string, string> = {"0":"周日","1":"周一","2":"周二","3":"周三","4":"周四","5":"周五","6":"周六"};
    parts2.push(dowNames[dow] ?? `周${dow}`);
  } else if (dom === "*" && dow === "*") parts2.push("每天");

  if (h === "*") parts2.push("每小时");
  else if (h.startsWith("*/")) parts2.push(`每 ${h.slice(2)} 小时`);
  else parts2.push(`${h} 点`);

  if (mi === "*") parts2.push("每分钟");
  else if (mi.startsWith("*/")) parts2.push(`每 ${mi.slice(2)} 分钟`);
  else parts2.push(`${mi} 分`);

  if (parts.length === 6) {
    const s = parts[0];
    if (s !== "*" && s !== "0") parts2.push(`${s} 秒`);
  }

  return parts2.join(" ");
}

interface BuilderPanelProps {
  fieldIndex: number;
  parts: string[];
  is6: boolean;
  onClose: () => void;
  onChange: (newExpr: string) => void;
}

function BuilderPanel({ fieldIndex, parts, is6, onClose, onChange }: BuilderPanelProps) {
  const cfg = is6 ? [
    { label: "秒", min: 0, max: 59 },
    { label: "分钟", min: 0, max: 59 },
    { label: "小时", min: 0, max: 23 },
    { label: "日", min: 1, max: 31 },
    { label: "月", min: 1, max: 12 },
    { label: "周(0=日)", min: 0, max: 6 },
  ][fieldIndex] : [
    { label: "分钟", min: 0, max: 59 },
    { label: "小时", min: 0, max: 23 },
    { label: "日", min: 1, max: 31 },
    { label: "月", min: 1, max: 12 },
    { label: "周(0=日)", min: 0, max: 6 },
  ][fieldIndex];

  if (!cfg) return null;

  const current = parts[fieldIndex] ?? "*";
  const parsed = parseField(current, cfg.min, cfg.max);
  const selected = new Set(parsed?.values ?? []);

  const all = Array.from({ length: cfg.max - cfg.min + 1 }, (_, i) => i + cfg.min);
  const isAll = current === "*";

  function toggle(v: number) {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    if (next.size === 0 || next.size === all.length) {
      setField("*");
    } else {
      const sorted = [...next].sort((a, b) => a - b);
      setField(sorted.join(","));
    }
  }

  function setField(val: string) {
    const newParts = [...parts];
    newParts[fieldIndex] = val;
    onChange(newParts.join(" "));
  }

  return (
    <div className="ct-builder-overlay" onClick={onClose}>
      <div className="ct-builder-panel" onClick={e => e.stopPropagation()}>
        <div className="ct-builder-head">
          <span>{cfg.label} 可视化选择</span>
          <button onClick={() => setField("*")}>全选 (*)</button>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="ct-builder-grid" style={{ gridTemplateColumns: `repeat(${Math.min(12, all.length)}, 1fr)` }}>
          {all.map(v => (
            <button
              key={v}
              className={`ct-builder-cell ${selected.has(v) && !isAll ? "on" : ""} ${isAll ? "all" : ""}`}
              onClick={() => toggle(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="ct-builder-expr">当前值: <code>{current}</code></div>
      </div>
    </div>
  );
}

/** F25 Crontab 工具 */
export default function CrontabTool({ instanceId }: ToolProps) {
  const ns = `cron:${instanceId}`;
  const [expr, setExpr] = usePersistentState(`${ns}:expr`, "*/5 * * * *");
  const [builderField, setBuilderField] = usePersistentState<number | null>(`${ns}:bf`, null);

  const resolved = MACROS[expr.trim().toLowerCase()] ?? expr.trim();
  const parts = resolved.split(/\s+/);

  const parsed = useMemo(() => {
    const p = parts;
    if (p.length === 6) {
      const f0 = parseField(p[0], 0, 59);
      const f1 = parseField(p[1], 0, 59);
      const f2 = parseField(p[2], 0, 23);
      const f3 = parseField(p[3], 1, 31);
      const f4 = parseField(p[4], 1, 12, MONTHS);
      const f5 = parseField(p[5], 0, 6, ["SUN","MON","TUE","WED","THU","FRI","SAT"]);
      if (!f0||!f1||!f2||!f3||!f4||!f5) return null;
      return { fields: [f1,f2,f3,f4,f5], secField: f0, is6: true };
    }
    if (p.length !== 5) return null;
    const f0 = parseField(p[0], 0, 59);
    const f1 = parseField(p[1], 0, 23);
    const f2 = parseField(p[2], 1, 31);
    const f3 = parseField(p[3], 1, 12, MONTHS);
    const f4 = parseField(p[4], 0, 6, ["SUN","MON","TUE","WED","THU","FRI","SAT"]);
    if (!f0||!f1||!f2||!f3||!f4) return null;
    return { fields: [f0,f1,f2,f3,f4], secField: null, is6: false };
  }, [expr]);

  const valid = parsed !== null;
  const runs = useMemo(() => parsed ? nextRuns(parsed.fields, 5) : [], [parsed]);

  function randomDemo() {
    setExpr(PRESETS[Math.floor(Math.random() * PRESETS.length)].expr);
  }

  return (
    <div className="ct-tool">
      <div className="ct-expr-card">
        <input
          className={`ct-expr ${valid ? "" : "err"}`}
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          placeholder="分 时 日 月 周  例：*/5 * * * *"
          spellCheck={false}
        />
        <button onClick={randomDemo}>随机示例</button>
        <button onClick={() => valid && copyText(resolved)} disabled={!valid}>复制</button>
      </div>

      {MACROS[expr.trim().toLowerCase()] && (
        <div className="ct-macro-note">宏展开: {MACROS[expr.trim().toLowerCase()]}</div>
      )}

      {valid
        ? <div className="ct-desc">📖 {describe(parts)}</div>
        : <div className="ct-desc err">表达式无效，需为 5 段（分 时 日 月 周）或 6 段（秒 分 时 日 月 周）</div>}

      <div className="ct-fields">
        {(parsed?.is6 ? FIELDS_6 : FIELDS_5).map((f, i) => (
          <div key={f.key} className={`ct-field ${valid ? "clickable" : "dim"}`}
            onClick={() => valid && setBuilderField(builderField === i ? null : i)}
            title={valid ? "点击可视化编辑" : undefined}>
            <div className="ct-field-val">{parts[i] ?? "—"}</div>
            <div className="ct-field-label">{f.label}</div>
            <div className="ct-field-range">{f.desc}</div>
          </div>
        ))}
      </div>

      {builderField !== null && valid && (
        <BuilderPanel
          fieldIndex={builderField}
          parts={parts}
          is6={parsed?.is6 ?? false}
          onClose={() => setBuilderField(null)}
          onChange={(newExpr) => { setExpr(newExpr); setBuilderField(null); }}
        />
      )}

      <div className="ct-presets">
        <div className="ct-section-title">宏别名</div>
        <div className="ct-preset-grid">
          {Object.entries(MACROS).slice(0, 6).map(([macro, exp]) => (
            <div key={macro} className="ct-preset" onClick={() => setExpr(macro)}>
              <span className="ct-preset-label">{macro}</span>
              <code className="ct-preset-expr">{exp}</code>
            </div>
          ))}
        </div>
      </div>

      <div className="ct-presets">
        <div className="ct-section-title">常用表达式</div>
        <div className="ct-preset-grid">
          {PRESETS.map((p) => (
            <div key={p.expr} className="ct-preset" onClick={() => setExpr(p.expr)}>
              <span className="ct-preset-label">{p.label}</span>
              <code className="ct-preset-expr">{p.expr}</code>
            </div>
          ))}
        </div>
      </div>

      {valid && (
        <div className="ct-runs">
          <div className="ct-section-title">接下来 5 次执行</div>
          {runs.length === 0 ? (
            <div className="ct-no-run">未来一段时间内无匹配执行时间</div>
          ) : runs.map((r, i) => (
            <div key={i} className="ct-run">
              <span className="ct-run-idx">#{i + 1}</span>
              <span className="ct-run-time">{r.toLocaleString("zh-CN", { hour12: false })}</span>
              <span className="ct-run-dow">周{DOWS[r.getDay()]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
