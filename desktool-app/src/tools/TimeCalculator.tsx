import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText } from "../useCopyFeedback";
import { TIMEZONE_LIST as ZONES } from "./timezones";
import "./TimeCalculator.css";

type Tab = "parse" | "batch" | "diff" | "calc";

function fmtFull(d: Date, tz?: string): string {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false, timeZone: tz,
    }).format(d);
  } catch { return "—"; }
}

/** 尝试解析输入，支持时间戳(s/ms)、ISO、本地日期字符串 */
function parseInput(raw: string): { ok: true; ms: number } | { ok: false; msg: string } {
  const s = raw.trim();
  if (!s) return { ok: false, msg: "" };
  // 纯数字：秒或毫秒判断
  if (/^-?\d+$/.test(s)) {
    const n = Number(s);
    // 10 位以内视为秒，13 位视为毫秒，其他按毫秒
    const ms = s.length <= 10 ? n * 1000 : n;
    return { ok: true, ms };
  }
  const ms = Date.parse(s);
  if (Number.isFinite(ms)) return { ok: true, ms };
  return { ok: false, msg: `无法解析：${s}` };
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;          // positive = past, negative = future
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? "前" : "后";
  const s = Math.floor(abs / 1000);
  if (s < 60) return `${s} 秒${suffix}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} 分钟${suffix}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时${suffix}`;
  const days = Math.floor(h / 24);
  if (days < 365) return `${days} 天${suffix}`;
  return `${Math.floor(days / 365)} 年${suffix}`;
}

/** 生成数据库格式 */
function dbFormats(ms: number, d: Date): { label: string; value: string }[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  const Y = d.getFullYear(), M = d.getMonth() + 1, D = d.getDate();
  const h = d.getHours(), min = d.getMinutes(), sec = d.getSeconds();
  return [
    { label: "Unix 时间戳(秒)", value: String(Math.floor(ms / 1000)) },
    { label: "Unix 时间戳(毫秒)", value: String(ms) },
    { label: "MySQL DATETIME", value: `${Y}-${pad(M)}-${pad(D)} ${pad(h)}:${pad(min)}:${pad(sec)}` },
    { label: "MySQL DATE", value: `${Y}-${pad(M)}-${pad(D)}` },
    { label: "ISO 8601", value: new Date(ms).toISOString() },
    { label: "RFC 2822", value: new Date(ms).toUTCString() },
    { label: "年/月/日", value: `${Y}年${pad(M)}月${pad(D)}日` },
    { label: "相对时间", value: relativeTime(ms) },
  ];
}

// ─── 解析子页面 ────────────────────────────────────────────────
function ParseTab({ ns }: { ns: string }) {
  const [input, setInput] = usePersistentState(`${ns}:p:in`, "");
  const result = parseInput(input);

  function copy(v: string) { copyText(v); }

  const ms = result.ok ? result.ms : null;
  const d = ms !== null ? new Date(ms) : null;

  return (
    <div className="tc-parse">
      <div className="tc-row">
        <input
          className="tc-inp"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="时间戳(秒/毫秒)或日期字符串，如 1700000000 或 2024-06-01 12:00:00"
        />
        <button onClick={() => setInput(String(Date.now()))}>当前</button>
        <button onClick={() => setInput("")}>清空</button>
      </div>

      {!result.ok && result.msg && <div className="tc-err">{result.msg}</div>}

      {d && ms !== null && (
        <>
          <div className="tc-section-title">多格式解析结果</div>
          <table className="tc-table">
            <tbody>
              {dbFormats(ms, d).map((r) => (
                <tr key={r.label} onClick={() => copy(r.value)} title="点击复制">
                  <td className="tc-td-label">{r.label}</td>
                  <td className="tc-td-val">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="tc-section-title">多时区时间</div>
          <table className="tc-table">
            <tbody>
              {ZONES.map((z) => (
                <tr key={z.id} onClick={() => copy(fmtFull(d, z.tz))} title="点击复制">
                  <td className="tc-td-label">{z.label}</td>
                  <td className="tc-td-val">{fmtFull(d, z.tz)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ─── 批量转换 ────────────────────────────────────────────────────
function BatchTab({ ns }: { ns: string }) {
  const [input, setInput] = usePersistentState(`${ns}:b:in`, "");
  const [outputUnit, setOutputUnit] = usePersistentState<"ms" | "s">(`${ns}:b:unit`, "ms");

  const lines = input.split("\n").map((l) => l.trim()).filter(Boolean);
  const results = lines.map((line) => {
    const r = parseInput(line);
    if (!r.ok) return { raw: line, err: r.msg || "解析失败" };
    const d = new Date(r.ms);
    return {
      raw: line,
      ts: outputUnit === "ms" ? r.ms : Math.floor(r.ms / 1000),
      datetime: fmtFull(d),
      iso: d.toISOString(),
    };
  });

  function copyAll() {
    const text = results
      .map((r) => ("err" in r ? `${r.raw}\t错误` : `${r.raw}\t${r.ts}\t${r.datetime}\t${r.iso}`))
      .join("\n");
    copyText(text);
  }

  return (
    <div className="tc-batch">
      <div className="tc-batch-head">
        <span className="tc-hint">每行一个时间戳或日期字符串</span>
        <label>
          输出时间戳单位：
          <select value={outputUnit} onChange={(e) => setOutputUnit(e.target.value as "ms" | "s")}>
            <option value="ms">毫秒</option>
            <option value="s">秒</option>
          </select>
        </label>
        <button onClick={copyAll} disabled={results.length === 0}>复制全部</button>
      </div>
      <textarea
        className="tc-batch-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={"1700000000000\n2024-01-01 12:00:00\n1700000001"}
        spellCheck={false}
      />
      {results.length > 0 && (
        <table className="tc-table tc-batch-table">
          <thead>
            <tr>
              <th>原始输入</th>
              <th>时间戳({outputUnit})</th>
              <th>本地日期时间</th>
              <th>ISO 8601</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i} className={"err" in r ? "tc-err-row" : ""}>
                <td className="tc-mono">{r.raw}</td>
                {"err" in r ? (
                  <td colSpan={3} className="tc-err">{r.err}</td>
                ) : (
                  <>
                    <td className="tc-mono">{r.ts}</td>
                    <td>{r.datetime}</td>
                    <td className="tc-mono">{r.iso}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── 时间差计算 ───────────────────────────────────────────────────
function DiffTab({ ns }: { ns: string }) {
  const [a, setA] = usePersistentState(`${ns}:d:a`, "");
  const [b, setB] = usePersistentState(`${ns}:d:b`, "");

  const ra = parseInput(a), rb = parseInput(b);
  const diff = ra.ok && rb.ok ? Math.abs(ra.ms - rb.ms) : null;

  function diffRows(ms: number) {
    const totalS = Math.floor(ms / 1000);
    const totalMin = Math.floor(ms / 60000);
    const totalH = Math.floor(ms / 3600000);
    const totalD = Math.floor(ms / 86400000);
    const d = Math.floor(totalD);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return [
      { label: "毫秒", value: String(ms) },
      { label: "秒", value: String(totalS) },
      { label: "分钟", value: String(totalMin) },
      { label: "小时", value: String(totalH) },
      { label: "天", value: String(totalD) },
      { label: "精确", value: `${d} 天 ${h} 小时 ${m} 分钟 ${s} 秒` },
    ];
  }

  return (
    <div className="tc-diff">
      <div className="tc-diff-inputs">
        <div className="tc-diff-field">
          <label>起始时间</label>
          <input className="tc-inp" value={a} onChange={(e) => setA(e.target.value)}
            placeholder="时间戳或日期字符串" />
          {ra.ok && <div className="tc-hint">{fmtFull(new Date(ra.ms))}</div>}
          {!ra.ok && ra.msg && <div className="tc-err">{ra.msg}</div>}
        </div>
        <div className="tc-diff-field">
          <label>结束时间</label>
          <input className="tc-inp" value={b} onChange={(e) => setB(e.target.value)}
            placeholder="时间戳或日期字符串" />
          {rb.ok && <div className="tc-hint">{fmtFull(new Date(rb.ms))}</div>}
          {!rb.ok && rb.msg && <div className="tc-err">{rb.msg}</div>}
        </div>
      </div>
      {diff !== null && (
        <>
          <div className="tc-section-title">时间差</div>
          <table className="tc-table">
            <tbody>
              {diffRows(diff).map((r) => (
                <tr key={r.label}>
                  <td className="tc-td-label">{r.label}</td>
                  <td className="tc-td-val">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ─── 时间加减 ─────────────────────────────────────────────────────
function CalcTab({ ns }: { ns: string }) {
  const [base, setBase] = usePersistentState(`${ns}:c:base`, "");
  const [amount, setAmount] = usePersistentState(`${ns}:c:amount`, "1");
  const [unit, setUnit] = usePersistentState<"d" | "h" | "m" | "s" | "ms" | "month" | "year">(`${ns}:c:unit`, "d");

  const rb = parseInput(base || String(Date.now()));
  const n = Number(amount);

  const UNIT_MS: Record<string, number> = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };

  function calcResult(baseMs: number, delta: number, op: "add" | "sub"): number {
    if (unit === "month") {
      const d = new Date(baseMs);
      d.setMonth(d.getMonth() + (op === "add" ? delta : -delta));
      return d.getTime();
    }
    if (unit === "year") {
      const d = new Date(baseMs);
      d.setFullYear(d.getFullYear() + (op === "add" ? delta : -delta));
      return d.getTime();
    }
    const ms = delta * (UNIT_MS[unit] ?? 1);
    return op === "add" ? baseMs + ms : baseMs - ms;
  }

  const addResult = rb.ok && Number.isFinite(n) ? calcResult(rb.ms, n, "add") : null;
  const subResult = rb.ok && Number.isFinite(n) ? calcResult(rb.ms, n, "sub") : null;

  const UNIT_LABEL: Record<string, string> = {
    ms: "毫秒", s: "秒", m: "分钟", h: "小时", d: "天", month: "月", year: "年"
  };

  return (
    <div className="tc-calc">
      <div className="tc-row">
        <input className="tc-inp" value={base} onChange={(e) => setBase(e.target.value)}
          placeholder="基准时间（留空为当前时间）" style={{ flex: 2 }} />
        <button onClick={() => setBase("")}>当前</button>
      </div>
      {rb.ok && <div className="tc-hint" style={{ marginTop: 4 }}>{fmtFull(new Date(rb.ms))}</div>}
      <div className="tc-row" style={{ marginTop: 8 }}>
        <input className="tc-inp" type="number" value={amount}
          onChange={(e) => setAmount(e.target.value)} style={{ width: 100 }} />
        <select value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)}>
          <option value="ms">毫秒</option>
          <option value="s">秒</option>
          <option value="m">分钟</option>
          <option value="h">小时</option>
          <option value="d">天</option>
          <option value="month">月</option>
          <option value="year">年</option>
        </select>
      </div>
      {addResult !== null && (
        <table className="tc-table" style={{ marginTop: 12 }}>
          <tbody>
            <tr>
              <td className="tc-td-label">加 {amount} {UNIT_LABEL[unit] ?? unit}</td>
              <td className="tc-td-val">{fmtFull(new Date(addResult))}</td>
              <td className="tc-td-val tc-mono">{addResult} ms</td>
            </tr>
            <tr>
              <td className="tc-td-label">减 {amount} {UNIT_LABEL[unit] ?? unit}</td>
              <td className="tc-td-val">{fmtFull(new Date(subResult!))}</td>
              <td className="tc-td-val tc-mono">{subResult} ms</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── 主组件 ────────────────────────────────────────────────────────
/**
 * F33 时间戳计算器
 * 四个子页面：解析、批量、时间差、时间加减。
 */
export default function TimeCalculator({ instanceId }: ToolProps) {
  const ns = `tcalc:${instanceId}`;
  const [tab, setTab] = usePersistentState<Tab>(`${ns}:tab`, "parse");

  const TABS: { id: Tab; label: string }[] = [
    { id: "parse", label: "格式解析" },
    { id: "batch", label: "批量转换" },
    { id: "diff", label: "时间差" },
    { id: "calc", label: "时间加减" },
  ];

  return (
    <div className="tc-tool">
      <div className="tc-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "on" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="tc-body">
        {tab === "parse" && <ParseTab ns={ns} />}
        {tab === "batch" && <BatchTab ns={ns} />}
        {tab === "diff" && <DiffTab ns={ns} />}
        {tab === "calc" && <CalcTab ns={ns} />}
      </div>
    </div>
  );
}
