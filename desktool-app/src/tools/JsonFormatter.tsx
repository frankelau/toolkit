import { useEffect, useMemo, useRef, useState } from "react";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText, toast } from "../useCopyFeedback";
import { openTextFile } from "../openFile";
import { saveTextWithDialog } from "../saveFile";
import EmptyHint from "../components/EmptyHint";
import SearchableTextarea from "../components/SearchableTextarea";
import SplitPane from "../components/SplitPane";
import JsonTree from "./JsonTree";
import { pythonToJson } from "./pythonToJson";
import { locateJsonError } from "./jsonErrorLocate";
import { parseCurl } from "./parseCurl";
import "./JsonFormatter.css";

type Status =
  | { kind: "idle" }
  | { kind: "ok"; msg: string }
  | { kind: "error"; msg: string; errorLine?: number };

type ViewMode = "text" | "tree" | "types";

type TypeLang = "typescript" | "java" | "go";

/**
 * F01 JSON 美化工具
 * 格式化、压缩、校验、键排序、Python dict 修正。
 * 输出区可切换文本/树视图（树视图支持折叠、复制节点）。
 * 支持区域字号缩放。输入/输出/设置按标签实例持久化。
 */
export default function JsonFormatter({ instanceId }: ToolProps) {
  const ns = `json:${instanceId}`;
  const [input, setInput] = usePersistentState(`${ns}:input`, "");
  const [output, setOutput] = usePersistentState(`${ns}:output`, "");
  const [indent, setIndent] = usePersistentState(`${ns}:indent`, 2);
  const [sortKeys, setSortKeys] = usePersistentState(`${ns}:sort`, false);
  const [view, setView] = usePersistentState<ViewMode>(`${ns}:view`, "tree");
  const [typeLang, setTypeLang] = usePersistentState<TypeLang>(`${ns}:typelang`, "typescript");
  const [scale, setScale] = usePersistentState(`${ns}:scale`, 1);
  const [ratio, setRatio] = usePersistentState(`${ns}:ratio`, 0.5);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [jsonPath, setJsonPath] = usePersistentState(`${ns}:jpath`, "");
  const [reqOpen, setReqOpen] = usePersistentState(`${ns}:req`, false);
  const [reqMethod, setReqMethod] = usePersistentState(`${ns}:rm`, "GET");
  const [reqUrl, setReqUrl] = usePersistentState(`${ns}:ru`, "");
  const [reqHeaders, setReqHeaders] = usePersistentState(`${ns}:rh`, "");
  const [reqBody, setReqBody] = usePersistentState(`${ns}:rb`, "");
  const [reqLoading, setReqLoading] = useState(false);
  const autoFormatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 输入变化后自动格式化（防抖 600ms）
  useEffect(() => {
    if (!input.trim()) return;
    if (autoFormatTimerRef.current) clearTimeout(autoFormatTimerRef.current);
    autoFormatTimerRef.current = setTimeout(() => {
      handleFormat()
    }, 600);
    return () => {
      if (autoFormatTimerRef.current) clearTimeout(autoFormatTimerRef.current);
    };
  }, [input, indent, sortKeys]);

  function parse(text: string): unknown {
    if (!text.trim()) throw new Error("输入为空");
    return JSON.parse(text);
  }

  function sortValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sortValue);
    if (value && typeof value === "object") {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = sortValue((value as Record<string, unknown>)[key]);
          return acc;
        }, {});
    }
    return value;
  }

  function stringify(value: unknown, space: number | string): string {
    return JSON.stringify(sortKeys ? sortValue(value) : value, null, space);
  }

  function describeError(e: Error, text: string): { msg: string; line?: number } {
    // 优先用引擎无关的扫描器定位（兼容 WKWebView/JavaScriptCore，其报错无 position）
    const loc = locateJsonError(text);
    if (loc) {
      return { msg: `${loc.message}（第 ${loc.line} 行第 ${loc.col} 列）`, line: loc.line };
    }
    // 扫描器认为合法但 JSON.parse 仍失败（极少见），退回引擎信息
    const m = /position (\d+)/.exec(e.message);
    if (m) {
      const pos = Number(m[1]);
      const before = text.slice(0, pos);
      const line = before.split("\n").length;
      const col = pos - before.lastIndexOf("\n");
      return { msg: `${e.message}（第 ${line} 行第 ${col} 列）`, line };
    }
    return { msg: e.message };
  }

  async function handleRequest() {
    if (!reqUrl.trim()) return;
    setReqLoading(true);
    try {
      const hdrs: Record<string, string> = {};
      for (const line of reqHeaders.split("\n")) {
        const idx = line.indexOf(":");
        if (idx > 0) hdrs[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
      const hasBody = ["POST", "PUT", "PATCH"].includes(reqMethod);
      const r = await tauriFetch(reqUrl.trim(), {
        method: reqMethod,
        headers: hdrs,
        body: hasBody && reqBody.trim() ? reqBody : undefined,
      });
      const text = await r.text();
      try {
        setInput(JSON.stringify(JSON.parse(text), null, indent));
      } catch {
        setInput(text);
      }
      setStatus({ kind: "ok", msg: `HTTP ${r.status} ${r.statusText}` });
    } catch (e) {
      setStatus({ kind: "error", msg: `请求失败：${(e as Error).message}` });
    } finally {
      setReqLoading(false);
    }
  }

  function handleFormat() {
    try {
      const value = parse(input);
      setOutput(stringify(value, indent));
      setView("tree")
      setStatus({ kind: "ok", msg: "格式化成功，JSON 合法" });
    } catch (e) {
      const { msg, line } = describeError(e as Error, input);
      setStatus({ kind: "error", msg: `解析失败：${msg}`, errorLine: line });
      setOutput(input);
    }
  }

  function handleMinify() {
    try {
      const value = parse(input);
      setOutput(stringify(value, 0));
      setStatus({ kind: "ok", msg: "压缩成功" });
    } catch (e) {
      const { msg, line } = describeError(e as Error, input);
      setStatus({ kind: "error", msg: `解析失败：${msg}`, errorLine: line });
      setOutput(input);
    }
  }

  function handleValidate() {
    try {
      parse(input);
      setStatus({ kind: "ok", msg: "✓ JSON 合法" });
    } catch (e) {
      const { msg, line } = describeError(e as Error, input);
      setStatus({ kind: "error", msg: `✗ 非法 JSON：${msg}`, errorLine: line });
      setOutput(input);
    }
  }

  /** Python dict 修正：None/True/False、单引号、元组括号等 → JSON 后格式化 */
  function handleFixPython() {
    try {
      const fixed = pythonToJson(input);
      const value = JSON.parse(fixed);
      const formatted = stringify(value, indent);
      setInput(formatted);
      setOutput(formatted);
      setView("tree");
      setStatus({ kind: "ok", msg: "已修正 Python 字面量并格式化" });
    } catch (e) {
      setStatus({
        kind: "error",
        msg: `修正失败：${(e as Error).message}（可能含无法识别的 Python 语法）`,
      });
    }
  }

  async function handleQuery() {
    try {
      const data = parse(input);
      if (!jsonPath.trim()) {
        setOutput(stringify(data, indent));
        setStatus({ kind: "ok", msg: "已格式化" });
        return;
      }
      const { JSONPath } = await import("jsonpath-plus");
      const result = JSONPath({ path: jsonPath.trim(), json: data as object });
      setOutput(stringify(result, indent));
      setStatus({ kind: "ok", msg: `查询命中 ${Array.isArray(result) ? result.length : 1} 项` });
    } catch (e) {
      setStatus({ kind: "error", msg: `查询失败：${(e as Error).message}` });
    }
  }

  function handleUnescape() {
    try {
      const trimmed = input.trim();
      const unwrapped = trimmed.startsWith('"') ? (JSON.parse(trimmed) as string) : trimmed.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      const data = JSON.parse(unwrapped);
      const formatted = stringify(data, indent);
      setInput(formatted);
      setOutput(formatted);
      setView("tree");
      setStatus({ kind: "ok", msg: "已解包并格式化" });
    } catch (e) {
      setStatus({ kind: "error", msg: `解包失败：${(e as Error).message}` });
    }
  }

  function handleEscape() {
    try {
      const data = parse(input);
      setOutput(JSON.stringify(JSON.stringify(data)));
      setStatus({ kind: "ok", msg: "已转义为字符串" });
    } catch (e) {
      setStatus({ kind: "error", msg: `转义失败：${(e as Error).message}` });
    }
  }

  // ── JSON → 类型定义 ──
  function inferTsType(value: unknown, typeName: string, depth = 0): string {
    const indent = "  ".repeat(depth);
    if (value === null) return "null";
    if (typeof value === "string") return "string";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (Array.isArray(value)) {
      if (value.length === 0) return "unknown[]";
      const elemTypes = value.map((v) => inferTsType(v, typeName, depth));
      const unique = [...new Set(elemTypes)];
      if (unique.length === 1) return `${unique[0]}[]`;
      return `(${unique.join(" | ")})[]`;
    }
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 0) return "Record<string, never>";
      const fields = keys.map((k) => {
        const val = obj[k];
        const optional = val === null || val === undefined;
        const tsType = inferTsType(val, k, depth + 1);
        const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : `"${k}"`;
        return `${indent}  ${safeKey}${optional ? "?" : ""}: ${tsType};`;
      });
      return `{\n${fields.join("\n")}\n${indent}}`;
    }
    return "unknown";
  }

  function generateTypes(): string {
    try {
      const data = parse(input);
      const rootName = "Root";
      if (typeLang === "typescript") {
        return `interface ${rootName} ${inferTsType(data, rootName)}\n`;
      }
      if (typeLang === "java") {
        return generateJava(data, rootName);
      }
      return generateGo(data, rootName);
    } catch (e) {
      setStatus({ kind: "error", msg: `类型生成失败：${(e as Error).message}` });
      return "";
    }
  }

  function generateJava(value: unknown, name: string): string {
    const classes: string[] = [];
    function visit(val: unknown, n: string): string {
      if (val === null) return "Object";
      if (typeof val === "string") return "String";
      if (typeof val === "number") return Number.isInteger(val) ? "Long" : "Double";
      if (typeof val === "boolean") return "Boolean";
      if (Array.isArray(val)) {
        if (val.length === 0) return "List<Object>";
        return `List<${visit(val[0], n + "Item")}>`;
      }
      if (typeof val === "object") {
        const obj = val as Record<string, unknown>;
        const fields = Object.entries(obj).map(([k, v]) => {
          const javaType = visit(v, capitalize(k));
          const safeName = k.replace(/[^a-zA-Z0-9_]/g, "_");
          return `    private ${javaType} ${safeName};`;
        });
        classes.push(`public class ${capitalize(n)} {\n${fields.join("\n")}\n}`);
        return capitalize(n);
      }
      return "Object";
    }
    visit(value, name);
    return classes.join("\n\n");
  }

  function generateGo(value: unknown, name: string): string {
    const structs: string[] = [];
    function visit(val: unknown, n: string): string {
      if (val === null) return "*interface{}";
      if (typeof val === "string") return "string";
      if (typeof val === "number") return Number.isInteger(val) ? "int64" : "float64";
      if (typeof val === "boolean") return "bool";
      if (Array.isArray(val)) {
        if (val.length === 0) return "[]interface{}";
        return `[]${visit(val[0], n+"Item")}`;
      }
      if (typeof val === "object") {
        const obj = val as Record<string, unknown>;
        const fields = Object.entries(obj).map(([k, v]) => {
          const goType = visit(v, capitalize(k));
          const jsonTag = `\`json:"${k}"\``;
          return `    ${capitalize(k)} ${goType} ${jsonTag}`;
        });
        structs.push(`type ${capitalize(n)} struct {\n${fields.join("\n")}\n}`);
        return capitalize(n);
      }
      return "interface{}";
    }
    visit(value, name);
    return `package main\n\n${structs.join("\n\n")}`;
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function handleGenerateTypes() {
    const types = generateTypes();
    if (types) {
      setOutput(types);
      setView("types");
      setStatus({ kind: "ok", msg: `已生成 ${typeLang} 类型定义` });
    }
  }

  // ── JSON Schema 校验 ──
  async function handleSchemaValidate() {
    try {
      const data = parse(input);
      // 简易 Schema 校验：检查基本结构合法性
      const inputStr = input.trim();
      if (inputStr.includes('"$schema"') || (inputStr.includes('"type"') && inputStr.includes('"properties"'))) {
        // 作为 Schema 自校验：确保基本字段存在
        const schema = data as Record<string, unknown>;
        const errors: string[] = [];
        if (!schema["type"] && !schema["properties"]) errors.push("缺少 type 或 properties 字段");
        if (errors.length === 0) {
          setStatus({ kind: "ok", msg: "✓ Schema 结构合法" });
        } else {
          setStatus({ kind: "error", msg: `Schema 校验失败：${errors.join("; ")}` });
        }
      } else {
        setStatus({ kind: "error", msg: "未检测到 Schema（需要 $schema 或 type+properties 字段）" });
      }
    } catch (e) {
      setStatus({ kind: "error", msg: `校验失败：${(e as Error).message}` });
    }
  }

  function handleCopy() {
    if (!output) return;
    copyText(output);
  }

  function handleClear() {
    setInput("");
    setOutput("");
    setStatus({ kind: "idle" });
  }

  async function openFile() {
    const res = await openTextFile();
    if (res?.text != null) setInput(res.text);
  }

  async function exportOutput() {
    if (!output) return;
    const res = await saveTextWithDialog(output, "formatted.json");
    if (res.saved) toast("已保存到 " + res.path, "success");
  }

  // 树视图所需的解析结果
  const treeData = useMemo(() => {
    if (view !== "tree" || !output.trim()) return { ok: false, value: null as unknown };
    try {
      return { ok: true, value: JSON.parse(output) };
    } catch {
      return { ok: false, value: null };
    }
  }, [view, output]);

  const zoom = (d: number) =>
    setScale((s) => Math.min(2, Math.max(0.6, +(s + d).toFixed(2))));

  return (
    <div className="json-tool">
      <div className="json-toolbar">
        <button onClick={handleFormat}>格式化</button>
        <button onClick={handleMinify}>压缩</button>
        <button onClick={handleValidate}>校验</button>
        <button onClick={handleFixPython} title="将 Python dict（None/True/False、单引号等）修正为 JSON">
          修正 Python
        </button>
        <button onClick={handleUnescape}>解包转义</button>
        <button onClick={handleEscape}>转为字符串</button>
        <span className="sep" />
        <select
          value={typeLang}
          onChange={(e) => setTypeLang(e.target.value as TypeLang)}
          className="json-typelang"
        >
          <option value="typescript">TypeScript</option>
          <option value="java">Java</option>
          <option value="go">Go</option>
        </select>
        <button onClick={handleGenerateTypes} title="根据 JSON 生成类型定义">生成类型</button>
        <button onClick={handleSchemaValidate} title="校验 JSON Schema">Schema校验</button>
        <span className="sep" />
        <input
          className="json-jpath"
          value={jsonPath}
          onChange={(e) => setJsonPath(e.target.value)}
          placeholder="JSONPath 如 $.data[*].name（空=完整格式化）"
          spellCheck={false}
        />
        <button onClick={handleQuery}>查询</button>
        <span className="sep" />
        <label>
          缩进
          <select
            value={indent}
            onChange={(e) => setIndent(Number(e.target.value))}
          >
            <option value={2}>2 空格</option>
            <option value={4}>4 空格</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={sortKeys}
            onChange={(e) => setSortKeys(e.target.checked)}
          />
          键排序
        </label>
        <span className="sep" />
        <div className="json-view-toggle">
          <button
            className={view === "text" ? "on" : ""}
            onClick={() => setView("text")}
          >
            文本
          </button>
          <button
            className={view === "tree" ? "on" : ""}
            onClick={() => setView("tree")}
          >
            树
          </button>
          <button
            className={view === "types" ? "on" : ""}
            onClick={() => setView("types")}
          >
            类型
          </button>
        </div>
        <div className="json-zoom">
          <button onClick={() => zoom(-0.1)} title="缩小">A-</button>
          <span className="json-zoom-val">{Math.round(scale * 100)}%</span>
          <button onClick={() => zoom(0.1)} title="放大">A+</button>
        </div>
        <span className="sep" />
        <button
          className={reqOpen ? "req-active" : ""}
          onClick={() => setReqOpen((o) => !o)}
          title="HTTP 请求"
        >
          🌐 请求
        </button>
        <span className="sep" />
        <button onClick={openFile} title="打开文件">📁 打开</button>
        <button onClick={exportOutput} disabled={!output}>💾 导出</button>
        <button onClick={handleCopy} disabled={!output}>
          复制结果
        </button>
        <button onClick={handleClear}>清空</button>
      </div>

      {reqOpen && (
        <div className="json-req-panel">
          <div className="json-req-row">
            <select
              className="json-req-method"
              value={reqMethod}
              onChange={(e) => setReqMethod(e.target.value)}
            >
              {["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <input
              className="json-req-url"
              value={reqUrl}
              onChange={(e) => {
                const v = e.target.value;
                if (v.trimStart().startsWith("curl ")) {
                  try {
                    const p = parseCurl(v);
                    setReqMethod((["GET","POST","PUT","DELETE","PATCH","HEAD"].includes(p.method) ? p.method : "POST"));
                    setReqUrl(p.url);
                    setReqHeaders(p.headers.map((h) => `${h.key}: ${h.value}`).join("\n"));
                    setReqBody(p.body);
                  } catch { setReqUrl(v); }
                } else {
                  setReqUrl(v);
                }
              }}
              onKeyDown={(e) => e.key === "Enter" && handleRequest()}
              placeholder="https://api.example.com/endpoint 或直接粘贴 curl 命令"
              spellCheck={false}
            />
            <button
              className="json-req-send"
              onClick={handleRequest}
              disabled={reqLoading || !reqUrl.trim()}
            >
              {reqLoading ? "…" : "发送"}
            </button>
          </div>
          <div className="json-req-extras">
            <textarea
              className="json-req-textarea"
              value={reqHeaders}
              onChange={(e) => setReqHeaders(e.target.value)}
              placeholder={"Headers（每行 Key: Value）\nContent-Type: application/json\nAuthorization: Bearer TOKEN"}
              rows={3}
              spellCheck={false}
            />
            {["POST", "PUT", "PATCH"].includes(reqMethod) && (
              <textarea
                className="json-req-textarea"
                value={reqBody}
                onChange={(e) => setReqBody(e.target.value)}
                placeholder={'Body\n{"key": "value"}'}
                rows={3}
                spellCheck={false}
              />
            )}
          </div>
        </div>
      )}

      {status.kind !== "idle" && (
        <div className={`json-status ${status.kind}`}>{status.msg}</div>
      )}

      <div className="json-panes">
        <SplitPane
          ratio={ratio}
          onRatioChange={setRatio}
          left={
            <div
              className="json-pane-wrap"
              style={{ fontSize: `${13 * scale}px`, width: "100%", position: "relative" }}
            >
              <EmptyHint visible={!input}>粘贴 JSON，或拖入 / 📁 打开文件</EmptyHint>
              <SearchableTextarea
                value={input}
                onChange={setInput}
                placeholder="在此粘贴 JSON 或 Python dict...（Cmd/Ctrl+F 查找）"
                showLineNumbers
              />
            </div>
          }
          right={
            status.kind === "error" && status.errorLine ? (
              <div
                className="json-pane-wrap json-error-view"
                style={{ fontSize: `${13 * scale}px`, width: "100%" }}
              >
                {output.split("\n").map((ln, i) => {
                  const lineNo = i + 1;
                  const isErr = lineNo === status.errorLine;
                  return (
                    <div
                      key={i}
                      className={`json-err-line ${isErr ? "err" : ""}`}
                    >
                      <span className="json-err-gutter">{lineNo}</span>
                      <span className="json-err-code">{ln || " "}</span>
                    </div>
                  );
                })}
              </div>
            ) : view === "text" ? (
              <div
                className="json-pane-wrap"
                style={{ fontSize: `${13 * scale}px`, width: "100%" }}
              >
                <SearchableTextarea
                  value={output}
                  onChange={setOutput}
                  placeholder="格式化结果"
                  readOnly
                  showLineNumbers
                />
              </div>
            ) : view === "types" ? (
              <div
                className="json-pane-wrap"
                style={{ fontSize: `${13 * scale}px`, width: "100%" }}
              >
                <SearchableTextarea
                  value={output}
                  onChange={setOutput}
                  placeholder="点击「生成类型」按钮，根据 JSON 生成类型定义"
                  readOnly
                  showLineNumbers
                />
              </div>
            ) : (
              <div className="json-tree-wrap" style={{ width: "100%" }}>
                {treeData.ok ? (
                  <JsonTree data={treeData.value} fontScale={scale} />
                ) : (
                  <div className="json-tree-empty">
                    先格式化出合法 JSON 再切换到树视图
                  </div>
                )}
              </div>
            )
          }
        />
      </div>
    </div>
  );
}
