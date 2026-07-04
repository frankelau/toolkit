import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText } from "../useCopyFeedback";
import "./BaseConvert.css";

const COMMON = [
  { base: 2, name: "二进制" },
  { base: 8, name: "八进制" },
  { base: 10, name: "十进制" },
  { base: 16, name: "十六进制" },
];

function detectPrefix(s: string): { digits: string; base: number | null } {
  const lower = s.toLowerCase();
  if (lower.startsWith("0x")) return { digits: s.slice(2), base: 16 };
  if (lower.startsWith("0b")) return { digits: s.slice(2), base: 2 };
  if (lower.startsWith("0o")) return { digits: s.slice(2), base: 8 };
  return { digits: s, base: null };
}

function toTwosComplement(v: bigint, bits: number): string {
  const n = BigInt(bits);
  const min = -(1n << (n - 1n));
  const max = (1n << (n - 1n)) - 1n;
  if (v < min || v > max) return `超出${bits}位范围`;
  const mask = (1n << n) - 1n;
  return ((v + (1n << n)) & mask).toString(2).padStart(bits, "0");
}

/**
 * F10 进制转换
 * 2~36 进制任意互转，常用进制实时联动。
 * 支持 0x/0b/0o 前缀自动检测，补码显示。
 */
export default function BaseConvert({ instanceId }: ToolProps) {
  const ns = `base:${instanceId}`;
  const [fromBase, setFromBase] = usePersistentState(`${ns}:from`, 10);
  const [value, setValue] = usePersistentState(`${ns}:value`, "");

  // Prefix detection (handle negation before prefix check)
  const trimmed = value.trim();
  const neg = trimmed.startsWith("-");
  const withoutSign = neg ? trimmed.slice(1) : trimmed;
  const { digits: strippedDigits, base: prefixBase } = detectPrefix(withoutSign);
  const effectiveBase = prefixBase ?? fromBase;
  const showPrefixHint = prefixBase !== null && prefixBase !== fromBase;

  // Parse using effectiveBase
  function parseDigits(digits: string, base: number): bigint | null {
    if (!digits) return null;
    const bigBase = BigInt(base);
    let result = 0n;
    for (const ch of digits.toLowerCase()) {
      const d = parseInt(ch, 36);
      if (Number.isNaN(d) || d >= base) return null;
      result = result * bigBase + BigInt(d);
    }
    return result;
  }

  let parsed: bigint | null = null;
  let parseError = false;
  if (trimmed) {
    const raw = parseDigits(strippedDigits, effectiveBase);
    parsed = raw !== null ? (neg ? -raw : raw) : null;
    parseError = parsed === null;
  }

  function convert(target: number): string {
    if (parsed === null) return "";
    return parsed.toString(target);
  }

  function copy(text: string) {
    if (text) copyText(text);
  }

  return (
    <div className="bc-tool">
      <div className="bc-input-card">
        <div className="bc-row">
          <label>输入进制</label>
          <select
            value={fromBase}
            onChange={(e) => setFromBase(Number(e.target.value))}
          >
            {Array.from({ length: 35 }, (_, i) => i + 2).map((b) => (
              <option key={b} value={b}>
                {b} 进制
              </option>
            ))}
          </select>
        </div>
        <input
          className={`bc-value ${parseError ? "err" : ""}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`输入 ${fromBase} 进制数`}
          spellCheck={false}
        />
        {parseError && <div className="bc-err">非法的 {fromBase} 进制数字</div>}
        {showPrefixHint && (
          <div className="bc-hint">检测到前缀，已按 {effectiveBase} 进制解析</div>
        )}
      </div>

      <div className="bc-results">
        {COMMON.map((c) => (
          <div key={c.base} className="bc-result-row">
            <span className="bc-result-label">
              {c.name} <small>({c.base})</small>
            </span>
            <span
              className="bc-result-val"
              onClick={() => copy(convert(c.base))}
              title="点击复制"
            >
              {convert(c.base) || "—"}
            </span>
          </div>
        ))}
      </div>

      <div className="bc-all">
        <div className="bc-all-title">全部进制（2~36）</div>
        <div className="bc-all-grid">
          {Array.from({ length: 35 }, (_, i) => i + 2).map((b) => (
            <div key={b} className="bc-all-item">
              <span className="bc-all-base">{b}</span>
              <span
                className="bc-all-val"
                onClick={() => copy(convert(b))}
                title="点击复制"
              >
                {convert(b) || "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {parsed !== null && (
        <div className="bc-twos">
          <div className="bc-twos-title">补码（有符号整数）</div>
          {([8, 16, 32] as const).map((bits) => (
            <div key={bits} className="bc-twos-row">
              <span className="bc-twos-label">{bits}位</span>
              <span className="bc-twos-val">{toTwosComplement(parsed!, bits)}</span>
            </div>
          ))}
        </div>
      )}

      {parsed !== null && (
        <div className="bc-bytesize">
          <div className="bc-bytesize-title">字节大小可视化</div>
          <div className="bc-bytesize-grid">
            <div className="bc-bytesize-row"><span>B</span><span>{parsed.toString()} B</span></div>
            <div className="bc-bytesize-row"><span>KB</span><span>{(Number(parsed) / 1024).toFixed(2)} KB</span></div>
            <div className="bc-bytesize-row"><span>MB</span><span>{(Number(parsed) / 1024 / 1024).toFixed(4)} MB</span></div>
            <div className="bc-bytesize-row"><span>GB</span><span>{(Number(parsed) / 1024 / 1024 / 1024).toFixed(6)} GB</span></div>
            <div className="bc-bytesize-row"><span>TB</span><span>{(Number(parsed) / 1024 / 1024 / 1024 / 1024).toFixed(8)} TB</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
