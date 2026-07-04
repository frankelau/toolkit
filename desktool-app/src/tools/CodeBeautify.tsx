import { useState, useEffect, useRef } from "react";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText, toast } from "../useCopyFeedback";
import { openTextFile } from "../openFile";
import { saveTextWithDialog } from "../saveFile";
import "./CodeBeautify.css";
import "highlight.js/styles/github.css";
import LineNumberedArea from "../components/LineNumberedArea";

type Lang = "js" | "css" | "html" | "xml" | "sql" | "json" | "ts" | "scss" | "less" | "yaml" | "go" | "python";

const LANGS: { id: Lang; name: string }[] = [
  { id: "js", name: "JavaScript" },
  { id: "ts", name: "TypeScript" },
  { id: "css", name: "CSS" },
  { id: "scss", name: "SCSS" },
  { id: "less", name: "LESS" },
  { id: "html", name: "HTML" },
  { id: "xml", name: "XML" },
  { id: "sql", name: "SQL" },
  { id: "json", name: "JSON" },
  { id: "yaml", name: "YAML" },
  { id: "go", name: "Go" },
  { id: "python", name: "Python" },
];

const EXT: Record<Lang, string> = {
  js: "js", css: "css", html: "html", xml: "xml", sql: "sql", json: "json",
  ts: "ts", scss: "scss", less: "less", yaml: "yaml", go: "go", python: "py",
};

/** 简单的 XML/HTML 缩进器（用于 XML，HTML 走 prettier） */
function formatXml(xml: string, indent: number): string {
  const pad = " ".repeat(indent);
  let formatted = "";
  let depth = 0;
  // 在标签之间换行
  const tokens = xml.replace(/>\s*</g, "><").replace(/></g, ">\n<").split("\n");
  for (const node of tokens) {
    if (/^<\/\w/.test(node)) depth = Math.max(depth - 1, 0);
    formatted += pad.repeat(depth) + node.trim() + "\n";
    if (
      /^<\w[^>]*[^/]>$/.test(node) &&
      !node.startsWith("<?") &&
      !/^<.*<\/.*>$/.test(node)
    ) {
      depth++;
    }
  }
  return formatted.trim();
}

/** 简单的 Go/C/Java 风格大括号语言缩进器 */
function formatBraceLang(code: string, indent: number): string {
  const pad = " ".repeat(indent);
  let result = "";
  let depth = 0;
  let inString = false;
  let stringChar = "";
  let inComment = false;
  let inLineComment = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1];

    if (inLineComment) {
      result += ch;
      if (ch === "\n") { inLineComment = false; depth = depth; }
      continue;
    }
    if (inComment) {
      result += ch;
      if (ch === "*" && next === "/") { result += "/"; i++; inComment = false; }
      continue;
    }
    if (inString) {
      result += ch;
      if (ch === "\\") { result += next ?? ""; i++; continue; }
      if (ch === stringChar) inString = false;
      continue;
    }

    if (ch === "/" && next === "/") { inLineComment = true; result += ch; continue; }
    if (ch === "/" && next === "*") { inComment = true; result += ch; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { inString = true; stringChar = ch; result += ch; continue; }

    if (ch === "{") {
      result += " {\n" + pad.repeat(depth + 1);
      depth++;
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
      result = result.trimEnd();
      result += "\n" + pad.repeat(depth) + "}";
    } else if (ch === ";") {
      result += ";\n" + pad.repeat(depth);
    } else if (ch === "\n") {
      // trim trailing spaces
      result = result.replace(/\s+$/, "");
      result += "\n" + pad.repeat(depth);
    } else {
      result += ch;
    }
  }
  // Clean up: remove blank lines, trim
  return result.split("\n").map(l => l.trimEnd()).filter((l, i, arr) => !(l.trim() === "" && (i === 0 || arr[i-1].trim() === ""))).join("\n").trim() + "\n";
}

/** 简单的 Python 缩进器（基于冒号） */
function formatPython(code: string, indent: number): string {
  const pad = " ".repeat(indent);
  const lines = code.split("\n");
  let depth = 0;
  const result: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/^\s+/, ""); // strip existing indent
    if (!line.trim()) { result.push(""); continue; }
    // dedent on return, break, continue, pass, else, except, finally, elif
    if (/^(return|break|continue|pass|else|elif|except|finally)\b/.test(line) && depth > 0) {
      // Check if previous line ended with colon - if so, keep at same depth
      const prev = result[result.length - 1]?.trimEnd();
      if (prev && !prev.endsWith(":")) {
        depth = Math.max(0, depth - 1);
      }
    }
    result.push(pad.repeat(depth) + line);
    if (line.trim().endsWith(":")) depth++;
  }
  return result.join("\n").trim() + "\n";
}

/** 各语言示例 */
const SAMPLES: Record<Lang, string> = {
  js: `function hi(name){console.log('hello '+name)}`,
  ts: `function hi(name:string):void{console.log('hello '+name)}`,
  css: `body{margin:0;padding:0}.box{color:red;font-size:14px}`,
  scss: `$color:red;.box{color:$color;&:hover{opacity:.8}}`,
  less: `@color:red;.box{color:@color;&:hover{opacity:.8}}`,
  html: `<div><p>你好</p><span>世界</span></div>`,
  xml: `<root><item id="1"><name>张三</name></item></root>`,
  sql: `select id,name from users where age>18 and city='北京' order by id`,
  json: `{"name":"张三","age":18,"tags":["a","b"]}`,
  yaml: `name: 张三\nage: 18\ntags: [a,b]`,
  go: `package main\nimport "fmt"\nfunc main(){fmt.Println("hello")}`,
  python: `def hi(name):\n    print(f"hello {name}")\nhi("world")`,
};

/**
 * F03 代码美化工具
 * JS/CSS/HTML/JSON 走 prettier；XML/SQL 走内置缩进器。
 * 单输入框 + 单选语言，输出带行号。
 */
export default function CodeBeautify({ instanceId }: ToolProps) {
  const ns = `code:${instanceId}`;
  const [lang, setLang] = usePersistentState<Lang>(`${ns}:lang`, "js");
  const [indent, setIndent] = usePersistentState(`${ns}:indent`, 2);
  const [input, setInput] = usePersistentState(`${ns}:input`, "");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [singleQuote, setSingleQuote] = usePersistentState(`${ns}:sq`, false);
  const [semi, setSemi] = usePersistentState(`${ns}:semi`, true);
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = codeRef.current;
    if (!el) return;
    el.textContent = output;
    el.removeAttribute("data-highlighted");
    if (!output) return;
    let cancelled = false;
    import("highlight.js").then(({ default: hljs }) => {
      if (cancelled || !codeRef.current) return;
      hljs.highlightElement(codeRef.current);
    }).catch(() => { /* highlight is best-effort */ });
    return () => { cancelled = true; };
  }, [output]);

  async function format() {
    setError("");
    setBusy(true);
    try {
      let result = "";
      if (lang === "xml") {
        result = formatXml(input, indent);
      } else if (lang === "go") {
        result = formatBraceLang(input, indent);
      } else if (lang === "python") {
        result = formatPython(input, indent);
      } else if (lang === "sql") {
        const { format: sqlFormat } = await import("sql-formatter");
        result = sqlFormat(input, { tabWidth: indent });
      } else if (lang === "ts") {
        const prettier = await import("prettier/standalone");
        const estree = await import("prettier/plugins/estree");
        const tsPlugin = await import("prettier/plugins/typescript");
        const plugins = [
          (estree as { default?: unknown }).default ?? estree,
          (tsPlugin as { default?: unknown }).default ?? tsPlugin,
        ] as never[];
        result = await prettier.format(input, {
          parser: "typescript",
          plugins,
          tabWidth: indent,
          singleQuote,
          semi,
        });
      } else if (lang === "scss" || lang === "less") {
        const prettier = await import("prettier/standalone");
        const postcss = await import("prettier/plugins/postcss");
        const plugins = [(postcss as { default?: unknown }).default ?? postcss] as never[];
        result = await prettier.format(input, {
          parser: lang,
          plugins,
          tabWidth: indent,
          singleQuote,
          semi,
        });
      } else if (lang === "yaml") {
        const prettier = await import("prettier/standalone");
        const yamlPlugin = await import("prettier/plugins/yaml");
        const plugins = [(yamlPlugin as { default?: unknown }).default ?? yamlPlugin] as never[];
        result = await prettier.format(input, {
          parser: "yaml",
          plugins,
          tabWidth: indent,
        });
      } else {
        // prettier standalone + 按需动态加载插件
        const prettier = await import("prettier/standalone");
        const parserMap: Record<string, { parser: string; plugins: Promise<unknown>[] }> = {
          js: {
            parser: "babel",
            plugins: [import("prettier/plugins/babel"), import("prettier/plugins/estree")],
          },
          json: {
            parser: "json",
            plugins: [import("prettier/plugins/babel"), import("prettier/plugins/estree")],
          },
          css: { parser: "css", plugins: [import("prettier/plugins/postcss")] },
          html: { parser: "html", plugins: [import("prettier/plugins/html")] },
        };
        const cfg = parserMap[lang];
        const loaded = await Promise.all(cfg.plugins);
        const plugins = loaded.map(
          (p) => (p as { default?: unknown }).default ?? p,
        ) as never[];
        const prettierOpts: Record<string, unknown> = {
          parser: cfg.parser,
          plugins,
          tabWidth: indent,
        };
        if (lang === "js" || lang === "css") {
          prettierOpts.singleQuote = singleQuote;
          prettierOpts.semi = semi;
        }
        result = await prettier.format(input, prettierOpts as Parameters<typeof prettier.format>[1]);
      }
      setOutput(result);
    } catch (e) {
      setOutput("");
      setError(`美化失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    if (output) copyText(output);
  }

  async function openFile() {
    const res = await openTextFile();
    if (res?.text != null) setInput(res.text);
  }

  async function exportOutput() {
    if (!output) return;
    const res = await saveTextWithDialog(output, `formatted.${EXT[lang]}`);
    if (res.saved) toast("已保存到 " + res.path, "success");
  }

  const outputLines = output ? output.split("\n") : [];

  return (
    <div className="cb-tool">
      <LineNumberedArea
        className="cb-input"
        value={input}
        onChange={setInput}
        placeholder="粘贴代码..."
        spellCheck={false}
      />

      <div className="cb-toolbar">
        <div className="cb-langs">
          {LANGS.map((l) => (
            <label key={l.id} className="cb-radio">
              <input
                type="radio"
                name={`cb-${instanceId}`}
                checked={l.id === lang}
                onChange={() => setLang(l.id)}
              />
              {l.name}
            </label>
          ))}
        </div>
        <button
          className="cb-link"
          onClick={() => setInput(SAMPLES[lang])}
          title="填入该语言示例"
        >
          示例
        </button>
        <label className="cb-indent">
          缩进
          <select value={indent} onChange={(e) => setIndent(Number(e.target.value))}>
            <option value={2}>2</option>
            <option value={4}>4</option>
          </select>
        </label>
        <label className="cb-checkbox">
          <input type="checkbox" checked={singleQuote} onChange={(e) => setSingleQuote(e.target.checked)} />
          单引号
        </label>
        <label className="cb-checkbox">
          <input type="checkbox" checked={semi} onChange={(e) => setSemi(e.target.checked)} />
          分号
        </label>
        <span className="cb-spacer" />
        <button onClick={openFile} title="打开文件">📁 打开</button>
        <button onClick={exportOutput} disabled={!output}>💾 导出</button>
        <button onClick={copy} disabled={!output}>
          复制结果
        </button>
        <button className="cb-primary" onClick={format} disabled={busy}>
          {busy ? "美化中…" : "格式化"}
        </button>
        <button
          onClick={() => {
            setInput("");
            setOutput("");
            setError("");
          }}
        >
          清空
        </button>
      </div>

      {error && <div className="cb-error">{error}</div>}

      <div className="cb-output">
        {outputLines.length === 0 ? (
          <div className="cb-output-empty">美化结果将显示在这里</div>
        ) : (
          <div className="cb-code">
            <div className="cb-gutter">
              {outputLines.map((_, i) => (
                <div key={i} className="cb-lineno">
                  {i + 1}
                </div>
              ))}
            </div>
            <pre className="cb-codetext"><code ref={codeRef} className="cb-hl" /></pre>
          </div>
        )}
      </div>
    </div>
  );
}
