import { useMemo } from "react";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText, toast } from "../useCopyFeedback";
import { openTextFile } from "../openFile";
import { saveTextWithDialog } from "../saveFile";
import { toMarkdownTable } from "./pipeTableParse";
import "./CsvConvert.css";
import LineNumberedArea from "../components/LineNumberedArea";

type OutFmt = "json" | "json-array" | "xml" | "sql" | "php" | "markdown" | "yaml";

/** 解析 CSV/TSV，自动识别分隔符，支持引号包裹 */
function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === delim) { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

function detectDelim(text: string): string {
  const firstLine = text.split("\n")[0] ?? "";
  const counts = { ",": 0, "\t": 0, ";": 0, "|": 0 };
  for (const c of firstLine) if (c in counts) counts[c as keyof typeof counts]++;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function coerce(v: string): string | number | boolean | null {
  const t = v.trim();
  if (t === "") return null;
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(t) && t.length < 16) return Number(t);
  return v;
}

function safeXmlTag(k: string): string {
  let s = k.replace(/[^\w一-鿿.\-]/g, "_");
  if (/^[^A-Za-z_一-鿿]/.test(s)) s = "_" + s;
  return s || "_";
}

function safeSqlCol(k: string): string {
  return "`" + k.replace(/`/g, "``") + "`";
}

function toXml(rows: Record<string, unknown>[]): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const items = rows.map((r) =>
    "  <row>\n" + Object.entries(r).map(([k, v]) => {
      const tag = safeXmlTag(k);
      return `    <${tag}>${esc(String(v ?? ""))}</${tag}>`;
    }).join("\n") + "\n  </row>"
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rows>\n${items}\n</rows>`;
}

function toSql(rows: Record<string, unknown>[], table: string): string {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]);
  const safeCols = keys.map(safeSqlCol);
  const vals = rows.map((r) =>
    `(${keys.map((k) => { const v = r[k]; return v == null ? "NULL" : typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : String(v); }).join(", ")})`
  ).join(",\n  ");
  return `INSERT INTO \`${table}\` (${safeCols.join(", ")}) VALUES\n  ${vals};`;
}

function toPhp(rows: Record<string, unknown>[]): string {
  const fmt = (v: unknown): string => v == null ? "null" : typeof v === "string" ? `'${v.replace(/'/g, "\\'")}'` : String(v);
  const items = rows.map((r) =>
    "  [" + Object.entries(r).map(([k, v]) => `'${k}' => ${fmt(v)}`).join(", ") + "]"
  ).join(",\n");
  return `<?php\n$data = [\n${items}\n];`;
}

function toYaml(rows: Record<string, unknown>[]): string {
  const fmtVal = (v: unknown): string => {
    if (v == null) return "null";
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    const s = String(v);
    if (/^[\d.-]+$/.test(s)) return `"${s}"`;
    if (/[:"'#&*!|<>?@{}\[\]]/.test(s) || s.startsWith(" ") || s.endsWith(" ")) return `"${s.replace(/"/g, '\\"')}"`;
    return s;
  };
  return rows.map((r) => {
    const entries = Object.entries(r);
    return `- ${entries[0] ? `${entries[0][0]}: ${fmtVal(entries[0][1])}` : ""}` + 
      entries.slice(1).map(([k, v]) => `\n  ${k}: ${fmtVal(v)}`).join("");
  }).join("\n") + "\n";
}

function jsonToCsv(text: string): string {
  const data = JSON.parse(text);
  if (!Array.isArray(data) || !data.length) throw new Error("需要 JSON 对象数组");
  const keys = Array.from(new Set(data.flatMap((o) => Object.keys(o || {}))));
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = keys.join(",");
  const body = data.map((o) => keys.map((k) => esc((o as Record<string, unknown>)[k])).join(",")).join("\n");
  return head + "\n" + body;
}

/** F32 Excel/CSV 转 JSON 等格式 */
export default function CsvConvert({ instanceId }: ToolProps) {
  const ns = `csv:${instanceId}`;
  const [input, setInput] = usePersistentState(`${ns}:input`, "");
  const [fmt, setFmt] = usePersistentState<OutFmt>(`${ns}:fmt`, "json");
  const [hasHeader, setHasHeader] = usePersistentState(`${ns}:header`, true);
  const [tableName, setTableName] = usePersistentState(`${ns}:table`, "data");
  const [reverse, setReverse] = usePersistentState(`${ns}:rev`, false);
  const [view, setView] = usePersistentState<"text" | "table">(`${ns}:view`, "text");

  const { output, error, rowCount, colCount, headers, preview } = useMemo(() => {
    if (!input.trim()) return { output: "", error: "", rowCount: 0, colCount: 0, headers: [] as string[], preview: [] as string[][] };

    if (reverse) {
      try {
        const out = jsonToCsv(input);
        return { output: out, error: "", rowCount: 0, colCount: 0, headers: [] as string[], preview: [] as string[][] };
      } catch (e) {
        return { output: "", error: (e as Error).message, rowCount: 0, colCount: 0, headers: [] as string[], preview: [] as string[][] };
      }
    }

    try {
      const delim = detectDelim(input);
      const cells = parseCsv(input, delim);
      if (cells.length === 0) return { output: "", error: "无数据", rowCount: 0, colCount: 0, headers: [] as string[], preview: [] as string[][] };
      const headers = hasHeader ? cells[0] : cells[0].map((_, i) => `col${i + 1}`);
      const dataRows = hasHeader ? cells.slice(1) : cells;
      const objs = dataRows.map((r) =>
        Object.fromEntries(headers.map((h, i) => [h || `col${i + 1}`, coerce(r[i] ?? "")]))
      );
      let out = "";
      if (fmt === "json") out = JSON.stringify(objs, null, 2);
      else if (fmt === "json-array") out = JSON.stringify(cells, null, 2);
      else if (fmt === "xml") out = toXml(objs);
      else if (fmt === "sql") out = toSql(objs, tableName);
      else if (fmt === "php") out = toPhp(objs);
      else if (fmt === "yaml") out = toYaml(objs);
      else if (fmt === "markdown") {
        const headers2 = headers.map(String);
        const rows2 = dataRows.map((row) => headers.map((_, i) => String(row[i] ?? "")));
        out = toMarkdownTable(headers2, rows2);
      }
      return { output: out, error: "", rowCount: objs.length, colCount: headers.length, headers, preview: dataRows.slice(0, 50) };
    } catch (e) {
      return { output: "", error: (e as Error).message, rowCount: 0, colCount: 0, headers: [] as string[], preview: [] as string[][] };
    }
  }, [input, fmt, hasHeader, tableName, reverse]);

  async function openFile() {
    const res = await openTextFile();
    if (res?.text != null) setInput(res.text);
  }

  async function exportOutput() {
    if (!output) return;
    const fmtToExt: Record<OutFmt, string> = {
      json: "json",
      "json-array": "json",
      xml: "xml",
      sql: "sql",
      php: "php",
      markdown: "md",
      yaml: "yaml",
    };
    const filename = reverse ? "result.csv" : `result.${fmtToExt[fmt]}`;
    const res = await saveTextWithDialog(output, filename);
    if (res.saved) toast("已保存到 " + res.path, "success");
  }

  const canTableView = !reverse && headers.length > 0 && preview.length > 0;

  return (
    <div className="cv-tool">
      <div className="cv-toolbar">
        <label className="cv-check">
          <input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} />
          反向（JSON→CSV）
        </label>
        {!reverse && (
          <>
            <label className="cv-check">
              <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
              首行为表头
            </label>
            <label className="cv-fmt">输出
              <select value={fmt} onChange={(e) => setFmt(e.target.value as OutFmt)}>
                <option value="json">JSON (对象数组)</option>
                <option value="json-array">JSON (二维数组)</option>
                <option value="xml">XML</option>
                <option value="sql">SQL INSERT</option>
                <option value="php">PHP 数组</option>
                <option value="markdown">Markdown 表格</option>
                <option value="yaml">YAML</option>
              </select>
            </label>
            {fmt === "sql" && <label className="cv-fmt">表名<input value={tableName} onChange={(e) => setTableName(e.target.value)} /></label>}
            {canTableView && (
              <label className="cv-fmt">视图
                <select value={view} onChange={(e) => setView(e.target.value as "text" | "table")}>
                  <option value="text">文本</option>
                  <option value="table">表格预览</option>
                </select>
              </label>
            )}
          </>
        )}
        <span className="cv-spacer" />
        {rowCount > 0 && <span className="cv-stat">{rowCount} 行 × {colCount} 列</span>}
        <button onClick={openFile} title="打开文件">📁 打开</button>
        <button onClick={exportOutput} disabled={!output}>💾 导出</button>
        <button onClick={() => copyText(output)} disabled={!output}>复制</button>
      </div>
      <div className="cv-panes">
        <div className="cv-col">
          <div className="cv-head">{reverse ? "输入 JSON 对象数组" : "输入 CSV / TSV（粘贴 Excel 数据可直接用）"}</div>
          <LineNumberedArea className="cv-area" value={input} onChange={setInput} placeholder={reverse ? '[{"name":"张三","age":25},{"name":"李四","age":30}]' : "name,age,city\n张三,25,北京\n李四,30,上海"} spellCheck={false} />
        </div>
        <div className="cv-col">
          <div className="cv-head">{error ? <span className="cv-err">错误：{error}</span> : "转换结果"}</div>
          {canTableView && view === "table" ? (
            <div className="csv-grid">
              <table>
                <thead>
                  <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.map((row, ri) => (
                    <tr key={ri}>{headers.map((_, ci) => <td key={ci}>{row[ci] ?? ""}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <LineNumberedArea className="cv-area" value={output} readOnly spellCheck={false} />
          )}
        </div>
      </div>
    </div>
  );
}
