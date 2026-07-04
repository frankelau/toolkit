import { useEffect, useState } from "react";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText } from "../useCopyFeedback";
import "./PasswordGen.css";

const SETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digit: "0123456789",
  symbol: "!@#$%^&*()-_=+[]{};:,.<>?",
};

const WORD_LIST: string[] = [
  "apple","brave","cloud","dance","eagle","flame","grace","heart","ivory","jewel",
  "kings","light","magic","noble","ocean","pearl","queen","river","stone","tiger",
  "ultra","vivid","water","xenon","youth","zebra","amber","blaze","cedar","drift",
  "ember","frost","globe","haven","inlet","joust","knack","lemon","maple","north",
  "onyx","plaza","quill","radar","solar","thorn","umbra","vault","wheat","axiom",
  "bloom","crane","delta","envoy","fjord","grail","hinge","index","japan","kneel",
  "lunar","manor","nexus","orbit","prism","quest","relay","swamp","truce","unity",
  "vigor","wrath","exact","yield","zonal","atlas","birch","civic","delta","epoch",
  "flint","giant","hatch","irony","joker","karma","lemur","moose","notch","otter",
  "pixel","quota","rebel","scout","troop","ulcer","verse","whirl","xylem","yearn",
  "abbey","bacon","camel","depot","elbow","fable","guava","hover","image","jewel",
  "kudos","latch","metro","niche","offal","parka","quirk","robin","shelf","tower",
  "under","vinyl","waltz","extra","yacht","zesty","agent","bison","crest","debug",
  "ether","ferry","gloom","hyena","input","jaunt","knoll","lyric","mural","newt",
  "oxide","punch","quest","raven","shark","tuner","until","viola","width","xeric",
  "yodel","zonal","alarm","brand","crisp","dusty","error","flank","grimy","husky",
  "infer","jumpy","kiosk","lunar","minty","notch","optic","proxy","quirk","ridge",
  "slope","tabby","urban","vivid","windy","oxide","years","zippy","adorn","brush",
  "cloth","drape","equip","flute","grind","hyper","index","joist","ketch","lyric",
  "manor","night","olive","prime","quirk","rover","solar","tapir","ultra","valor",
];

function cryptoRandInt(max: number): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % max;
}

function shuffle(arr: string[]): string[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = cryptoRandInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const CONSONANTS = "bcdfghjklmnpqrstvwxz";
const VOWELS = "aeiou";

function pronounceablePass(length: number): string {
  let result = "";
  while (result.length < length) {
    result += CONSONANTS[cryptoRandInt(CONSONANTS.length)];
    result += VOWELS[cryptoRandInt(VOWELS.length)];
    if (result.length < length) result += CONSONANTS[cryptoRandInt(CONSONANTS.length)];
  }
  return result.slice(0, length);
}

function strength(pw: string): { label: string; level: number } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 16) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  const levels = ["很弱", "弱", "中等", "强", "很强"];
  const level = Math.min(score, 4);
  return { label: levels[level], level };
}

/**
 * F27 随机密码生成
 * 数字/大小写/符号可选，长度可调，强度提示，批量生成。
 */
export default function PasswordGen({ instanceId }: ToolProps) {
  const ns = `pwd:${instanceId}`;
  const [length, setLength] = usePersistentState(`${ns}:len`, 16);
  const [useLower, setLower] = usePersistentState(`${ns}:lower`, true);
  const [useUpper, setUpper] = usePersistentState(`${ns}:upper`, true);
  const [useDigit, setDigit] = usePersistentState(`${ns}:digit`, true);
  const [useSymbol, setSymbol] = usePersistentState(`${ns}:symbol`, false);
  const [count, setCount] = usePersistentState(`${ns}:count`, 5);
  const [noAmbig, setNoAmbig] = usePersistentState(`${ns}:noAmbig`, false);
  const [passphrase, setPassphrase] = usePersistentState(`${ns}:passphrase`, false);
  const [pronounceable, setPronounceable] = usePersistentState(`${ns}:pronounce`, false);
  const [wordCount, setWordCount] = usePersistentState(`${ns}:wordCount`, 4);
  const [list, setList] = useState<string[]>([]);

  function pool(): string {
    const AMBIG = new Set("0Ol1I");
    return (
      (useLower ? [...SETS.lower].filter(c => !noAmbig || !AMBIG.has(c)).join("") : "") +
      (useUpper ? [...SETS.upper].filter(c => !noAmbig || !AMBIG.has(c)).join("") : "") +
      (useDigit ? [...SETS.digit].filter(c => !noAmbig || !AMBIG.has(c)).join("") : "") +
      (useSymbol ? SETS.symbol : "")
    );
  }

  function generate() {
    if (pronounceable) {
      setList(Array.from({ length: count }, () => pronounceablePass(length)));
      return;
    }
    if (passphrase) {
      setList(Array.from({ length: count }, () => {
        const ws = Array.from({ length: wordCount }, () =>
          WORD_LIST[cryptoRandInt(WORD_LIST.length)]
        );
        return ws.join("-");
      }));
      return;
    }

    // Build per-set pools (respecting noAmbig filter)
    const AMBIG = new Set("0Ol1I");
    const activeSets: string[] = [];
    if (useLower) activeSets.push([...SETS.lower].filter(c => !noAmbig || !AMBIG.has(c)).join(""));
    if (useUpper) activeSets.push([...SETS.upper].filter(c => !noAmbig || !AMBIG.has(c)).join(""));
    if (useDigit) activeSets.push([...SETS.digit].filter(c => !noAmbig || !AMBIG.has(c)).join(""));
    if (useSymbol) activeSets.push(SETS.symbol);

    // Remove empty sets (e.g., if noAmbig removes all chars — unlikely but safe)
    const nonEmpty = activeSets.filter(s => s.length > 0);
    if (nonEmpty.length === 0) { setList([]); return; }

    const fullPool = nonEmpty.join("");

    setList(Array.from({ length: count }, () => {
      if (length <= 0) return "";
      // Guarantee at least one char from each enabled set
      const guaranteed = nonEmpty.map(s => s[cryptoRandInt(s.length)]);
      const remaining = Math.max(0, length - guaranteed.length);
      const extra = Array.from({ length: remaining }, () =>
        fullPool[cryptoRandInt(fullPool.length)]
      );
      return shuffle([...guaranteed, ...extra]).join("");
    }));
  }

  // 首次/参数变化时自动生成一批
  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length, useLower, useUpper, useDigit, useSymbol, count, noAmbig, passphrase, pronounceable, wordCount]);

  function copy(text: string) {
    copyText(text);
  }

  const noSet = !passphrase && !pool();

  return (
    <div className="pg-tool">
      <div className="pg-controls">
        {/* Passphrase toggle — always visible */}
        <div className="pg-row">
          <label>
            <input
              type="checkbox"
              checked={passphrase}
              onChange={(e) => setPassphrase(e.target.checked)}
            />
            Passphrase 模式
          </label>
          <label>
            <input
              type="checkbox"
              checked={pronounceable}
              onChange={(e) => setPronounceable(e.target.checked)}
            />
            Pronounceable 模式
          </label>
        </div>

        {!passphrase && (
          <>
            <div className="pg-row">
              <label>长度：{length}</label>
              <input
                type="range"
                min={4}
                max={64}
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
              />
            </div>
            <div className="pg-checks">
              <label>
                <input type="checkbox" checked={useLower} onChange={(e) => setLower(e.target.checked)} />
                小写 a-z
              </label>
              <label>
                <input type="checkbox" checked={useUpper} onChange={(e) => setUpper(e.target.checked)} />
                大写 A-Z
              </label>
              <label>
                <input type="checkbox" checked={useDigit} onChange={(e) => setDigit(e.target.checked)} />
                数字 0-9
              </label>
              <label>
                <input type="checkbox" checked={useSymbol} onChange={(e) => setSymbol(e.target.checked)} />
                符号 !@#
              </label>
              <label>
                <input type="checkbox" checked={noAmbig} onChange={(e) => setNoAmbig(e.target.checked)} />
                排除易混淆字符 (0Ol1I)
              </label>
            </div>
          </>
        )}

        {passphrase && (
          <div className="pg-row">
            <label>单词数：{wordCount}</label>
            <input
              type="range"
              min={3}
              max={8}
              value={wordCount}
              onChange={(e) => setWordCount(Number(e.target.value))}
            />
          </div>
        )}

        <div className="pg-row">
          <label>数量</label>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[1, 5, 10, 20].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <button className="pg-gen" onClick={generate} disabled={noSet}>
            重新生成
          </button>
        </div>
      </div>

      {noSet && <div className="pg-warn">请至少选择一种字符类型</div>}

      <div className="pg-list">
        {list.map((pw, i) => {
          const s = strength(pw);
          return (
            <div key={i} className="pg-item" onClick={() => copy(pw)} title="点击复制">
              <span className="pg-pw">{pw}</span>
              <span className={`pg-strength s${s.level}`}>{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
