import { useEffect, useState } from "react";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText } from "../useCopyFeedback";
import { TIMEZONE_LIST as ZONES } from "./timezones";
import "./TimeTool.css";

// Windows FILETIME 纪元 1601-01-01 与 Unix 纪元的差值（毫秒）
const FILETIME_EPOCH_DIFF_MS = 11644473600000;
// FILETIME 单位为 100 纳秒
function msToFiletime(ms: number): string {
  return ((BigInt(Math.round(ms)) + BigInt(FILETIME_EPOCH_DIFF_MS)) * 10000n).toString();
}
function filetimeToMs(ft: string): number {
  return Number(BigInt(ft.trim()) / 10000n - BigInt(FILETIME_EPOCH_DIFF_MS));
}

function fmt(d: Date, tz?: string): string {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(d);
  } catch {
    return "—";
  }
}

/**
 * F11 时间(戳)转换
 * 时间戳 ↔ 日期互转，秒/毫秒，多时区时钟。
 */
export default function TimeTool({ instanceId }: ToolProps) {
  const ns = `time:${instanceId}`;
  const [tsInput, setTsInput] = usePersistentState(`${ns}:ts`, "");
  const [unit, setUnit] = usePersistentState<"s" | "ms">(`${ns}:unit`, "ms");
  const [dateInput, setDateInput] = usePersistentState(`${ns}:date`, "");
  const [ftInput, setFtInput] = usePersistentState(`${ns}:ft`, "");
  const [ftToTsInput, setFtToTsInput] = usePersistentState(`${ns}:ftToTs`, "");
  const [now, setNow] = useState(Date.now());

  // 实时时钟
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 时间戳 → 日期
  let tsResult: { ok: boolean; date?: Date; msg?: string } = { ok: false };
  if (tsInput.trim()) {
    const n = Number(tsInput.trim());
    if (Number.isFinite(n)) {
      const ms = unit === "s" ? n * 1000 : n;
      tsResult = { ok: true, date: new Date(ms) };
    } else {
      tsResult = { ok: false, msg: "非法数字" };
    }
  }

  // 日期 → 时间戳
  let dateResult: { ok: boolean; ms?: number; msg?: string } = { ok: false };
  if (dateInput.trim()) {
    const ms = Date.parse(dateInput.trim());
    if (Number.isFinite(ms)) dateResult = { ok: true, ms };
    else dateResult = { ok: false, msg: "无法解析（试试 2024-01-01 12:00:00）" };
  }

  // FILETIME → 日期
  let ftResult: { ok: boolean; date?: Date; ms?: number; msg?: string } = { ok: false };
  if (ftInput.trim()) {
    try {
      const ms = filetimeToMs(ftInput);
      if (Number.isFinite(ms)) ftResult = { ok: true, date: new Date(ms), ms };
      else ftResult = { ok: false, msg: "非法 FILETIME" };
    } catch {
      ftResult = { ok: false, msg: "非法 FILETIME（应为正整数）" };
    }
  }

  // 日期/时间戳 → FILETIME
  let toFtResult: { ok: boolean; ft?: string; msg?: string } = { ok: false };
  if (ftToTsInput.trim()) {
    const raw = ftToTsInput.trim();
    // 纯数字按毫秒时间戳，否则按日期解析
    let ms: number;
    if (/^-?\d+$/.test(raw)) ms = Number(raw);
    else ms = Date.parse(raw);
    if (Number.isFinite(ms)) toFtResult = { ok: true, ft: msToFiletime(ms) };
    else toFtResult = { ok: false, msg: "无法解析（数字按毫秒，或填日期）" };
  }

  function useNow() {
    setTsInput(String(unit === "s" ? Math.floor(now / 1000) : now));
  }

  function copy(text: string) {
    copyText(text);
  }

  return (
    <div className="tt-tool">
      {/* 当前时间多时区时钟 */}
      <div className="tt-clocks">
        <div className="tt-now">
          <span className="tt-now-label">当前时间戳</span>
          <span className="tt-now-val" onClick={() => copy(String(now))}>
            {now} <small>ms</small>
          </span>
          <span className="tt-now-val" onClick={() => copy(String(Math.floor(now / 1000)))}>
            {Math.floor(now / 1000)} <small>s</small>
          </span>
        </div>
        <div className="tt-zones">
          {ZONES.map((z) => (
            <div key={z.id} className="tt-zone">
              <span className="tt-zone-label">{z.label}</span>
              <span className="tt-zone-time">{fmt(new Date(now), z.tz)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 时间戳 → 日期 */}
      <div className="tt-card">
        <div className="tt-card-head">
          <span>时间戳 → 日期</span>
          <div className="tt-unit">
            <button
              className={unit === "s" ? "on" : ""}
              onClick={() => setUnit("s")}
            >
              秒
            </button>
            <button
              className={unit === "ms" ? "on" : ""}
              onClick={() => setUnit("ms")}
            >
              毫秒
            </button>
            <button onClick={useNow}>当前</button>
          </div>
        </div>
        <input
          className="tt-input"
          value={tsInput}
          onChange={(e) => setTsInput(e.target.value)}
          placeholder={unit === "s" ? "如 1700000000" : "如 1700000000000"}
        />
        {tsResult.ok && tsResult.date && (
          <div className="tt-out">
            {ZONES.map((z) => (
              <div key={z.id} className="tt-out-row">
                <span className="tt-out-label">{z.label}</span>
                <span
                  className="tt-out-val"
                  onClick={() => copy(fmt(tsResult.date!, z.tz))}
                >
                  {fmt(tsResult.date!, z.tz)}
                </span>
              </div>
            ))}
          </div>
        )}
        {!tsResult.ok && tsResult.msg && (
          <div className="tt-err">{tsResult.msg}</div>
        )}
      </div>

      {/* 日期 → 时间戳 */}
      <div className="tt-card">
        <div className="tt-card-head">
          <span>日期 → 时间戳</span>
        </div>
        <input
          className="tt-input"
          value={dateInput}
          onChange={(e) => setDateInput(e.target.value)}
          placeholder="如 2024-01-01 12:00:00 或 2024-01-01T12:00:00Z"
        />
        {dateResult.ok && dateResult.ms !== undefined && (
          <div className="tt-out">
            <div className="tt-out-row">
              <span className="tt-out-label">毫秒</span>
              <span className="tt-out-val" onClick={() => copy(String(dateResult.ms))}>
                {dateResult.ms}
              </span>
            </div>
            <div className="tt-out-row">
              <span className="tt-out-label">秒</span>
              <span
                className="tt-out-val"
                onClick={() => copy(String(Math.floor(dateResult.ms! / 1000)))}
              >
                {Math.floor(dateResult.ms / 1000)}
              </span>
            </div>
          </div>
        )}
        {!dateResult.ok && dateResult.msg && (
          <div className="tt-err">{dateResult.msg}</div>
        )}
      </div>

      {/* Windows FILETIME ↔ Unix */}
      <div className="tt-card">
        <div className="tt-card-head">Windows FILETIME → 日期</div>
        <input
          className="tt-input"
          value={ftInput}
          onChange={(e) => setFtInput(e.target.value)}
          placeholder="如 133000000000000000（100 纳秒单位）"
        />
        {ftResult.ok && ftResult.date && (
          <div className="tt-out">
            <div className="tt-out-row">
              <span className="tt-out-label">本地</span>
              <span className="tt-out-val" onClick={() => copy(fmt(ftResult.date!))}>
                {fmt(ftResult.date)}
              </span>
            </div>
            <div className="tt-out-row">
              <span className="tt-out-label">UTC</span>
              <span className="tt-out-val" onClick={() => copy(fmt(ftResult.date!, "UTC"))}>
                {fmt(ftResult.date!, "UTC")}
              </span>
            </div>
            <div className="tt-out-row">
              <span className="tt-out-label">ms</span>
              <span className="tt-out-val" onClick={() => copy(String(ftResult.ms))}>
                {ftResult.ms}
              </span>
            </div>
          </div>
        )}
        {!ftResult.ok && ftResult.msg && <div className="tt-err">{ftResult.msg}</div>}
      </div>

      <div className="tt-card">
        <div className="tt-card-head">日期 / 时间戳(ms) → Windows FILETIME</div>
        <input
          className="tt-input"
          value={ftToTsInput}
          onChange={(e) => setFtToTsInput(e.target.value)}
          placeholder="如 1700000000000 或 2024-01-01 12:00:00"
        />
        {toFtResult.ok && toFtResult.ft && (
          <div className="tt-out">
            <div className="tt-out-row">
              <span className="tt-out-label">FILETIME</span>
              <span className="tt-out-val" onClick={() => copy(toFtResult.ft!)}>
                {toFtResult.ft}
              </span>
            </div>
          </div>
        )}
        {!toFtResult.ok && toFtResult.msg && <div className="tt-err">{toFtResult.msg}</div>}
      </div>
    </div>
  );
}
