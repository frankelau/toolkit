import { useState, useEffect } from "react";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText } from "../useCopyFeedback";
import * as C from "./codecs";
import "./EncodeTool.css";
import LineNumberedArea from "../components/LineNumberedArea";

interface Op {
  id: string;
  name: string;
  hint?: string;
  run: (s: string) => string;
}

// 加密/编码区
const ENCODE_OPS: Op[] = [
  { id: "unicode-e", name: "Unicode编码", hint: "\\u开头", run: C.unicodeEncode },
  { id: "url-e", name: "URL编码", hint: "%开头", run: C.urlEncode },
  { id: "utf16-e", name: "UTF16编码", hint: "\\u开头", run: C.utf16Encode },
  { id: "base64-e", name: "Base64编码", run: C.base64Encode },
  { id: "md5", name: "MD5计算", run: C.md5 },
  { id: "hex-e", name: "十六进制编码", run: C.hexEncode },
  { id: "sha1", name: "Sha1加密", run: C.sha1 },
  { id: "html-e", name: "HTML普通编码", run: C.htmlEncode },
  { id: "html-deep", name: "HTML深度编码", run: C.htmlEncodeDeep },
  { id: "html-js", name: "HTML转JS", run: C.htmlToJs },
  { id: "gzip-e", name: "Gzip压缩", run: C.gzipCompress },
  { id: "str-e", name: "字符串转义", run: C.strEscape },
  { id: "sha256", name: "SHA256", run: () => "" },
  { id: "hmac-sha256", name: "HMAC-SHA256", run: () => "" },
  { id: "base64url-e", name: "Base64URL编码", run: C.base64urlEncode },
  { id: "morse-e", name: "Morse编码", run: C.morseEncode },
  { id: "punycode-e", name: "Punycode编码", run: C.punycodeEncode },
  { id: "aes-e", name: "AES加密", run: () => "" },
  { id: "des-e", name: "DES加密", run: () => "" },
  { id: "auto", name: "自动识别", run: C.autoDetect },
];

// 解密/解码区
const DECODE_OPS: Op[] = [
  { id: "unicode-d", name: "Unicode解码", hint: "\\u开头", run: C.unicodeDecode },
  { id: "url-d", name: "URL解码", hint: "%开头", run: C.urlDecode },
  { id: "utf16-d", name: "UTF16解码", hint: "\\u开头", run: C.utf16Decode },
  { id: "base64-d", name: "Base64解码", run: C.base64Decode },
  { id: "hex-d", name: "十六进制解码", run: C.hexDecode },
  { id: "html-d", name: "HTML实体解码", run: C.htmlDecode },
  { id: "url-parse", name: "URL参数解析", run: C.urlParse },
  { id: "jwt", name: "JWT解码", run: C.jwtDecode },
  { id: "cookie", name: "Cookie格式化", run: C.cookieFormat },
  { id: "gzip-d", name: "Gzip解压", run: C.gzipDecompress },
  { id: "str-d", name: "字符串去转义", run: C.strUnescape },
  { id: "base64url-d", name: "Base64URL解码", run: C.base64urlDecode },
  { id: "morse-d", name: "Morse解码", run: C.morseDecode },
  { id: "punycode-d", name: "Punycode解码", run: C.punycodeDecode },
  { id: "aes-d", name: "AES解密", run: () => "" },
  { id: "des-d", name: "DES解密", run: () => "" },
];

const ALL = [...ENCODE_OPS, ...DECODE_OPS];

/**
 * F09 信息编解码工具
 * 单输入框 + 加密/解密两组单选编码方式，实时转换查看结果。
 */
export default function EncodeTool({ instanceId }: ToolProps) {
  const ns = `encode:${instanceId}`;
  const [input, setInput] = usePersistentState(`${ns}:input`, "");
  const [opId, setOpId] = usePersistentState(`${ns}:op`, "unicode-e");
  const [hmacKey, setHmacKey] = usePersistentState(`${ns}:hmacKey`, "");
  const [cryptoKey, setCryptoKey] = usePersistentState(`${ns}:cryptoKey`, "");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!input) {
      setResult("");
      setError("");
      return;
    }
    setError("");
    if (opId === "sha256") {
      C.sha256(input)
        .then((r) => { if (!cancelled) setResult(r); })
        .catch((e: Error) => {
          if (!cancelled) { setResult(""); setError(`转换失败：${e.message}`); }
        });
      return () => { cancelled = true; };
    }
    if (opId === "hmac-sha256") {
      C.hmacSha256(hmacKey, input)
        .then((r) => { if (!cancelled) setResult(r); })
        .catch((e: Error) => {
          if (!cancelled) { setResult(""); setError(`转换失败：${e.message}`); }
        });
      return () => { cancelled = true; };
    }
    if (opId === "aes-e") {
      try { setResult(C.aesEncrypt(input, cryptoKey)); } catch (e) { setError(`AES加密失败：${(e as Error).message}`); }
      return () => { cancelled = true; };
    }
    if (opId === "aes-d") {
      try { setResult(C.aesDecrypt(input, cryptoKey)); } catch (e) { setError(`AES解密失败：${(e as Error).message}`); }
      return () => { cancelled = true; };
    }
    if (opId === "des-e") {
      try { setResult(C.desEncrypt(input, cryptoKey)); } catch (e) { setError(`DES加密失败：${(e as Error).message}`); }
      return () => { cancelled = true; };
    }
    if (opId === "des-d") {
      try { setResult(C.desDecrypt(input, cryptoKey)); } catch (e) { setError(`DES解密失败：${(e as Error).message}`); }
      return () => { cancelled = true; };
    }
    const op = ALL.find((o) => o.id === opId);
    if (!op) return;
    try {
      setResult(op.run(input));
    } catch (e) {
      setResult("");
      setError(`转换失败：${(e as Error).message}`);
    }
  }, [input, opId, hmacKey, cryptoKey]);

  function copy() {
    if (result) copyText(result);
  }

  function clear() {
    setInput("");
    setResult("");
    setError("");
  }

  function radioGroup(ops: Op[]) {
    return ops.map((o) => (
      <label key={o.id} className="enc-radio">
        <input
          type="radio"
          name={`enc-${instanceId}`}
          checked={opId === o.id}
          onChange={() => setOpId(o.id)}
        />
        {o.name}
        {o.hint && <span className="enc-hint">({o.hint})</span>}
      </label>
    ));
  }

  return (
    <div className="enc-tool">
      {opId === "hmac-sha256" && (
        <div className="enc-group">
          <span className="enc-label">HMAC Key：</span>
          <input
            className="enc-hmac-key"
            type="text"
            value={hmacKey}
            onChange={(e) => setHmacKey(e.target.value)}
            placeholder="输入 HMAC 密钥"
            spellCheck={false}
          />
        </div>
      )}
      {(opId === "aes-e" || opId === "aes-d" || opId === "des-e" || opId === "des-d") && (
        <div className="enc-group">
          <span className="enc-label">密钥：</span>
          <input
            className="enc-hmac-key"
            type="text"
            value={cryptoKey}
            onChange={(e) => setCryptoKey(e.target.value)}
            placeholder="输入加密/解密密钥"
            spellCheck={false}
          />
        </div>
      )}

      <LineNumberedArea
        className="enc-input"
        value={input}
        onChange={setInput}
        placeholder="粘贴需要进行转换的字符串"
        spellCheck={false}
      />

      <div className="enc-group">
        <span className="enc-label">加密：</span>
        <div className="enc-radios">{radioGroup(ENCODE_OPS)}</div>
      </div>
      <div className="enc-group">
        <span className="enc-label">解密：</span>
        <div className="enc-radios">{radioGroup(DECODE_OPS)}</div>
      </div>

      <div className="enc-actions">
        <button onClick={copy} disabled={!result}>
          复制结果
        </button>
        <button onClick={clear}>清空</button>
      </div>

      {error && <div className="enc-error">{error}</div>}

      <LineNumberedArea
        className="enc-result"
        value={result}
        readOnly
        placeholder="转换结果"
        spellCheck={false}
      />
    </div>
  );
}
