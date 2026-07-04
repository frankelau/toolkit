import { useState, useEffect } from "react";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText, toast } from "../useCopyFeedback";
import "./CodeMinify.css";
import LineNumberedArea from "../components/LineNumberedArea";

type Lang = "js" | "css" | "html" | "json";
const LANGS: { id: Lang; name: string }[] = [
  { id: "js", name: "JavaScript" },
  { id: "css", name: "CSS" },
  { id: "html", name: "HTML" },
  { id: "json", name: "JSON" },
];

function minifyHtml(s: string): string {
  return s
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** F04 代码压缩 */
export default function CodeMinify({ instanceId }: ToolProps) {
  const ns = `minify:${instanceId}`;
  const [lang, setLang] = usePersistentState<Lang>(`${ns}:lang`, "js");
  const [input, setInput] = usePersistentState(`${ns}:input`, "");
  const [output, setOutput] = useState("");
  const [gzipSize, setGzipSize] = useState<number | null>(null);
  const [mangle, setMangle] = usePersistentState<boolean>(`minify:${instanceId}:mangle`, true);

  async function minify() {
    try {
      let result = "";
      if (lang === "js") {
        const { minify: terserMin } = await import("terser");
        const out = await terserMin(input, {
          format: { comments: false },
          mangle: mangle ? { toplevel: true } : false,
          compress: { drop_console: false, drop_debugger: false },
        });
        result = out.code ?? "";
      } else if (lang === "css") {
        const csso = await import("csso");
        result = csso.minify(input).css;
      } else if (lang === "json") {
        result = JSON.stringify(JSON.parse(input));
      } else {
        result = minifyHtml(input);
      }
      setOutput(result);
    } catch (e) {
      toast("压缩失败：" + (e as Error).message, "error");
    }
  }

  useEffect(() => {
    if (!output) {
      setGzipSize(null);
      return;
    }
    import("pako").then((pako) => {
      const gz = pako.gzip(output);
      setGzipSize(gz.length);
    });
  }, [output]);

  const savings = output && input
    ? `${((1 - output.length / input.length) * 100).toFixed(1)}% 减少 (${input.length} → ${output.length} 字节)${gzipSize != null ? ` · gzip 后约 ${gzipSize} 字节` : ""}`
    : "";

  return (
    <div className="cm-tool">
      <div className="cm-toolbar">
        {LANGS.map((l) => (
          <label key={l.id} className="cm-radio">
            <input type="radio" name={`cm-${instanceId}`} checked={l.id === lang} onChange={() => setLang(l.id)} />
            {l.name}
          </label>
        ))}
        <span className="cm-spacer" />
        {lang === "js" && (
          <label className="cm-radio">
            <input type="checkbox" checked={mangle} onChange={(e) => setMangle(e.target.checked)} /> 变量混淆
          </label>
        )}
        {savings && <span className="cm-savings">{savings}</span>}
        <button onClick={() => { setInput(""); setOutput(""); }}>清空</button>
        <button onClick={() => output && copyText(output)} disabled={!output}>复制结果</button>
        <button className="cm-primary" onClick={minify} disabled={!input.trim()}>压缩</button>
      </div>
      <div className="cm-panes">
        <div className="cm-col">
          <div className="cm-head">输入</div>
          <LineNumberedArea className="cm-area" value={input} onChange={setInput} placeholder="粘贴代码..." spellCheck={false} />
        </div>
        <div className="cm-col">
          <div className="cm-head">压缩结果</div>
          <LineNumberedArea className="cm-area" value={output} readOnly placeholder="压缩后的代码将显示在这里" spellCheck={false} />
        </div>
      </div>
    </div>
  );
}
