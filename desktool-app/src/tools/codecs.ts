import CryptoJS from "crypto-js";
import pako from "pako";

/** 各类编解码实现，供信息编解码工具使用 */

const td = new TextDecoder();
const te = new TextEncoder();

// ---------- 基础 ----------
function bytesToBinaryString(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return s;
}
function binaryStringToBytes(bin: string): Uint8Array {
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- Unicode ----------
export function unicodeEncode(s: string): string {
  return Array.from(s)
    .map((ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"))
    .join("");
}
export function unicodeDecode(s: string): string {
  return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)),
  );
}

// ---------- URL ----------
export const urlEncode = (s: string) => encodeURIComponent(s);
export const urlDecode = (s: string) => decodeURIComponent(s);

// ---------- UTF-16 (\uXXXX) ----------
export function utf16Encode(s: string): string {
  const result: string[] = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp <= 0xffff) {
      result.push("\\u" + cp.toString(16).toUpperCase().padStart(4, "0"));
    } else {
      // Supplementary plane: compute surrogate pair
      const reduced = cp - 0x10000;
      const high = 0xd800 + (reduced >> 10);
      const low = 0xdc00 + (reduced & 0x3ff);
      result.push(
        "\\u" + high.toString(16).toUpperCase().padStart(4, "0") +
        "\\u" + low.toString(16).toUpperCase().padStart(4, "0"),
      );
    }
  }
  return result.join("");
}
export function utf16Decode(s: string): string {
  // Handle \u{XXXX} Unicode code point escapes
  s = s.replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h) =>
    String.fromCodePoint(parseInt(h, 16)),
  );
  // Handle surrogate pairs: \uD8xx\uDCxx
  s = s.replace(/\\u([dD][89aAbB][0-9a-fA-F]{2})\\u([dD][cCdDeEfF][0-9a-fA-F]{2})/g, (_, hi, lo) => {
    const high = parseInt(hi, 16);
    const low = parseInt(lo, 16);
    const cp = 0x10000 + ((high - 0xd800) << 10) + (low - 0xdc00);
    return String.fromCodePoint(cp);
  });
  // Handle plain \uXXXX four-digit escapes
  s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)),
  );
  // Handle legacy \xHH two-digit escapes
  s = s.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)),
  );
  return s;
}

// ---------- Base64 (UTF-8 安全) ----------
export function base64Encode(s: string): string {
  return btoa(bytesToBinaryString(te.encode(s)));
}
export function base64Decode(s: string): string {
  return td.decode(binaryStringToBytes(atob(s.trim())));
}

// ---------- 十六进制 ----------
export function hexEncode(s: string): string {
  return Array.from(te.encode(s))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}
export function hexDecode(s: string): string {
  const clean = s.replace(/0x/gi, "").replace(/[\s,]+/g, "");
  if (clean.length % 2 !== 0) throw new Error("十六进制长度需为偶数");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  return td.decode(bytes);
}

// ---------- 哈希 ----------
export const md5 = (s: string) => CryptoJS.MD5(s).toString();
export const sha1 = (s: string) => CryptoJS.SHA1(s).toString();

// ---------- HTML 实体 ----------
const HTML_BASIC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
export function htmlEncode(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_BASIC[c]);
}
export function htmlEncodeDeep(s: string): string {
  return Array.from(s)
    .map((ch) => `&#${ch.codePointAt(0)};`)
    .join("");
}
export function htmlDecode(s: string): string {
  const el = document.createElement("textarea");
  el.innerHTML = s;
  return el.value;
}
/** HTML 转 JS（escape 到 \xHH / \uHHHH 形式，便于内嵌脚本） */
export function htmlToJs(s: string): string {
  return Array.from(s)
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code < 256) return "\\x" + code.toString(16).padStart(2, "0");
      return "\\u" + code.toString(16).padStart(4, "0");
    })
    .join("");
}

// ---------- 字符串转义 ----------
export function strEscape(s: string): string {
  return JSON.stringify(s).slice(1, -1);
}
export function strUnescape(s: string): string {
  return JSON.parse(`"${s.replace(/"/g, '\\"')}"`);
}

// ---------- Gzip ----------
export function gzipCompress(s: string): string {
  const compressed = pako.gzip(s);
  return btoa(bytesToBinaryString(compressed));
}
export function gzipDecompress(s: string): string {
  const bytes = binaryStringToBytes(atob(s.trim()));
  return pako.ungzip(bytes, { to: "string" });
}

// ---------- JWT 解码 ----------
export function jwtDecode(s: string): string {
  const parts = s.trim().split(".");
  if (parts.length < 2) throw new Error("不是有效的 JWT");
  const decode = (seg: string) => {
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const json = td.decode(binaryStringToBytes(atob(b64)));
    return JSON.parse(json);
  };
  const header = decode(parts[0]);
  const payload = decode(parts[1]);
  return JSON.stringify({ header, payload, signature: parts[2] ?? "" }, null, 2);
}

// ---------- Cookie 格式化 ----------
export function cookieFormat(s: string): string {
  return s
    .split(";")
    .map((kv) => kv.trim())
    .filter(Boolean)
    .map((kv) => {
      const idx = kv.indexOf("=");
      if (idx < 0) return kv;
      return `${kv.slice(0, idx).trim()} = ${kv.slice(idx + 1).trim()}`;
    })
    .join("\n");
}

// ---------- URL 参数解析 ----------
export function urlParse(s: string): string {
  try {
    const u = new URL(s.trim());
    const params: Record<string, string> = {};
    u.searchParams.forEach((v, k) => (params[k] = v));
    return JSON.stringify(
      {
        protocol: u.protocol,
        host: u.host,
        pathname: u.pathname,
        params,
        hash: u.hash,
      },
      null,
      2,
    );
  } catch {
    // 不是完整 URL，按 query string 解析
    const params: Record<string, string> = {};
    new URLSearchParams(s.replace(/^\?/, "")).forEach(
      (v, k) => (params[k] = v),
    );
    return JSON.stringify(params, null, 2);
  }
}

// ---------- SHA-256 / HMAC-SHA-256 (Web Crypto API) ----------
export async function sha256(input: string): Promise<string> {
  const data = te.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hmacSha256(key: string, input: string): Promise<string> {
  const keyData = te.encode(key);
  const inputData = te.encode(input);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signBuffer = await crypto.subtle.sign("HMAC", cryptoKey, inputData);
  return Array.from(new Uint8Array(signBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- Base64URL ----------
export function base64urlEncode(input: string): string {
  return base64Encode(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64urlDecode(input: string): string {
  const b64 = input
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
  return base64Decode(padded);
}

// ---------- Morse ----------
const MORSE_MAP: Record<string, string> = {
  A:".-",B:"-...",C:"-.-.",D:"-..",E:".",F:"..-.",G:"--.",H:"....",I:"..",J:".---",K:"-.-",L:".-..",M:"--",N:"-.",O:"---",P:".--.",Q:"--.-",R:".-.",S:"...",T:"-",U:"..-",V:"...-",W:".--",X:"-..-",Y:"-.--",Z:"--..",
  "0":"-----","1":".----","2":"..---","3":"...--","4":"....-","5":".....","6":"-....","7":"--...","8":"---..","9":"----.",
  ".":".-.-.-",",":"--..--","?":"..--..","!":"-.-.--","/":"-..-.","(":"-.--.",")":"-.--.-","&":".-...","=":"-...-", "+":".-.-.","-":"-....-","_":"..--.-","\"":".-..-.","@":".--.-."
};
const MORSE_REVERSE: Record<string, string> = Object.entries(MORSE_MAP).reduce((a,[k,v])=>{a[v]=k;return a;},{} as Record<string,string>);
export function morseEncode(s: string): string {
  return s.toUpperCase().split("").map(ch => MORSE_MAP[ch] ?? "").filter(Boolean).join(" ");
}
export function morseDecode(s: string): string {
  return s.trim().split(/\s+/).map(code => MORSE_REVERSE[code] ?? "").join("");
}

// ---------- Punycode (basic) ----------
export function punycodeEncode(s: string): string {
  try { return new URL(`http://${s}`).hostname; } catch { return s; }
}
export function punycodeDecode(s: string): string {
  try { return new URL(`http://${s}`).hostname; } catch { return s; }
}

// ---------- AES/DES ----------
export function aesEncrypt(text: string, key: string): string {
  return CryptoJS.AES.encrypt(text, key).toString();
}
export function aesDecrypt(ciphertext: string, key: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}
export function desEncrypt(text: string, key: string): string {
  return CryptoJS.DES.encrypt(text, key).toString();
}
export function desDecrypt(ciphertext: string, key: string): string {
  const bytes = CryptoJS.DES.decrypt(ciphertext, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// ---------- Auto detect ----------
export function autoDetect(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return "空输入";
  const results: string[] = [];
  if (/^[A-Za-z0-9+/]+=*$/.test(trimmed) && trimmed.length % 4 === 0) {
    try {
      const decoded = atob(trimmed);
      if (/^[\x20-\x7e]+$/.test(decoded)) results.push(`Base64 → ${decoded}`);
    } catch { }
  }
  if (trimmed.includes("%")) {
    try { const d = decodeURIComponent(trimmed); if (d !== trimmed) results.push(`URL → ${d}`); } catch { }
  }
  if (/\\u[0-9a-fA-F]{4}/.test(trimmed)) {
    results.push(`Unicode → ${trimmed.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))}`);
  }
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    try {
      const d = trimmed.match(/.{2}/g)!.map(b => String.fromCharCode(parseInt(b, 16))).join("");
      if (/^[\x20-\x7e]+$/.test(d)) results.push(`Hex → ${d}`);
    } catch { }
  }
  if (trimmed.split(".").length === 3) {
    try {
      const p = trimmed.split(".");
      const payload = JSON.parse(atob(p[1].replace(/-/g, "+").replace(/_/g, "/")));
      results.push(`JWT payload → ${JSON.stringify(payload)}`);
    } catch { }
  }
  if (/^[.\-\s]+$/.test(trimmed)) {
    const d = morseDecode(trimmed);
    if (d) results.push(`Morse → ${d}`);
  }
  return results.length > 0 ? results.join("\n") : "未识别到已知编码格式";
}
