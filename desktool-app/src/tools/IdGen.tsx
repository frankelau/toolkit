import { useState } from "react";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText } from "../useCopyFeedback";
import "./IdGen.css";

function uuidv4(): string {
  return crypto.randomUUID();
}

function uuidv7(): string {
  const ms = Date.now();
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  // embed 48-bit timestamp into bytes 0-5
  const hi = Math.floor(ms / 0x10000);
  const lo = ms & 0xffff;
  arr[0] = (hi >> 24) & 0xff;
  arr[1] = (hi >> 16) & 0xff;
  arr[2] = (hi >> 8) & 0xff;
  arr[3] = hi & 0xff;
  arr[4] = (lo >> 8) & 0xff;
  arr[5] = lo & 0xff;
  // version 7
  arr[6] = (arr[6] & 0x0f) | 0x70;
  // variant 10xx
  arr[8] = (arr[8] & 0x3f) | 0x80;
  const h = Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function nanoid(alphabet: string, size: number): string {
  let id = "";
  while (id.length < size) {
    const buf = new Uint8Array(size * 2);
    crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length && id.length < size; i++) {
      const idx = buf[i] & 63;
      if (idx < alphabet.length) id += alphabet[idx];
    }
  }
  return id;
}

// Twitter Snowflake：41 位时间戳 + 10 位机器 + 12 位序列
// 纪元取 Twitter 默认 1288834974657
const EPOCH = 1288834974657n;
let seq = 0n;
function snowflake(machineId = 1n): string {
  const ts = BigInt(Date.now()) - EPOCH;
  seq = (seq + 1n) & 0xfffn;
  const id = (ts << 22n) | ((machineId & 0x3ffn) << 12n) | seq;
  return id.toString();
}

function parseSnowflake(id: string): {
  ok: boolean;
  ts?: number;
  date?: string;
  machine?: string;
  seq?: string;
  msg?: string;
} {
  try {
    const n = BigInt(id.trim());
    const ts = Number((n >> 22n) + EPOCH);
    const machine = (n >> 12n) & 0x3ffn;
    const sq = n & 0xfffn;
    return {
      ok: true,
      ts,
      date: new Date(ts).toLocaleString("zh-CN"),
      machine: machine.toString(),
      seq: sq.toString(),
    };
  } catch {
    return { ok: false, msg: "非法的雪花 ID" };
  }
}

type Kind = "uuid" | "uuidv7" | "nanoid" | "snowflake" | "shortid";

const SHORTID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-";

/**
 * F30 UUID/ID 生成器
 * UUID v4 / UUID v7 / NanoID / Snowflake 生成，雪花 ID 解析。
 */
export default function IdGen({ instanceId }: ToolProps) {
  const [kind, setKind] = usePersistentState<Kind>(`idgen:${instanceId}:kind`, "uuid");
  const [count, setCount] = usePersistentState(`idgen:${instanceId}:count`, 5);
  const [nanoAlphabet, setNanoAlphabet] = usePersistentState(
    `idgen:${instanceId}:nanoAlphabet`,
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-"
  );
  const [nanoLength, setNanoLength] = usePersistentState(`idgen:${instanceId}:nanoLength`, 21);
  const [list, setList] = useState<string[]>([]);
  const [parseInput, setParseInput] = useState("");

  function generate() {
    let gen: () => string;
    if (kind === "uuid") gen = uuidv4;
    else if (kind === "uuidv7") gen = uuidv7;
    else if (kind === "nanoid") {
      const alpha = nanoAlphabet.length > 0 ? nanoAlphabet : "abcdefghijklmnopqrstuvwxyz";
      const len = Math.min(64, Math.max(4, nanoLength));
      gen = () => nanoid(alpha, len);
    } else gen = () => snowflake();
    if (kind === "shortid") {
      gen = () => nanoid(SHORTID_ALPHABET, 11);
    }
    setList(Array.from({ length: count }, gen));
  }

  function copy(text: string) {
    copyText(text);
  }

  const parsed = parseInput.trim() ? parseSnowflake(parseInput) : null;

  return (
    <div className="id-tool">
      <div className="id-controls">
        <div className="id-kinds">
          {(["uuid", "uuidv7", "nanoid", "snowflake", "shortid"] as const).map((k) => (
            <button
              key={k}
              className={k === kind ? "active" : ""}
              onClick={() => setKind(k)}
            >
              {k === "uuid"
                ? "UUID v4"
                : k === "uuidv7"
                ? "UUID v7"
                : k === "nanoid"
                ? "NanoID"
                : k === "snowflake"
                ? "Snowflake"
                : "ShortID"}
            </button>
          ))}
        </div>
        {kind === "nanoid" && (
          <div className="id-nano-config">
            <label className="id-nano-label">字母表</label>
            <input
              className="id-nano-input"
              value={nanoAlphabet}
              onChange={(e) => setNanoAlphabet(e.target.value)}
              spellCheck={false}
            />
            <label className="id-nano-label">长度</label>
            <input
              className="id-nano-len"
              type="number"
              min={4}
              max={64}
              value={nanoLength}
              onChange={(e) => {
                const v = Number(e.target.value);
                setNanoLength(Number.isNaN(v) ? 21 : Math.min(64, Math.max(4, v)));
              }}
            />
          </div>
        )}
        <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {[1, 5, 10, 20, 50].map((n) => (
            <option key={n} value={n}>{n} 个</option>
          ))}
        </select>
        <button className="id-gen" onClick={generate}>
          生成
        </button>
        <button onClick={() => copy(list.join("\n"))} disabled={!list.length}>
          复制全部
        </button>
      </div>

      <div className="id-list">
        {list.map((id, i) => (
          <div key={i} className="id-item" onClick={() => copy(id)} title="点击复制">
            {id}
          </div>
        ))}
        {!list.length && <div className="id-empty">点击「生成」开始</div>}
      </div>

      <div className="id-parse">
        <div className="id-parse-title">雪花 ID 解析</div>
        <input
          className="id-parse-input"
          value={parseInput}
          onChange={(e) => setParseInput(e.target.value)}
          placeholder="粘贴雪花 ID 解析时间/机器/序列"
          spellCheck={false}
        />
        {parsed && parsed.ok && (
          <div className="id-parse-out">
            <div><span>时间戳</span>{parsed.ts}</div>
            <div><span>日期</span>{parsed.date}</div>
            <div><span>机器 ID</span>{parsed.machine}</div>
            <div><span>序列号</span>{parsed.seq}</div>
          </div>
        )}
        {parsed && !parsed.ok && <div className="id-parse-err">{parsed.msg}</div>}
      </div>
    </div>
  );
}
