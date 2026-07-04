import { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import "highlight.js/styles/github.css";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText, toast } from "../useCopyFeedback";
import { parsePipeTable, toMarkdownTable, detectCols } from "./pipeTableParse";
import { saveTextWithDialog } from "../saveFile";
import SearchableTextarea from "../components/SearchableTextarea";
import SplitPane from "../components/SplitPane";
import "./MarkdownTool.css";

const SAMPLE = `# Markdown 预览

支持 **加粗**、*斜体*、\`代码\` 和[链接](https://tauri.app)。

## 列表
- 项目一
- 项目二

## 代码块
\`\`\`js
console.log("hello DeskTool");
\`\`\`

## 表格
| 工具 | 编号 |
| --- | --- |
| JSON 美化 | F01 |
| Markdown | F22 |
`;

type Mode = "edit" | "split" | "preview";

/**
 * F22 Markdown 转换工具
 * 三种模式：纯编辑 / 编辑+预览（可伸缩）/ 纯预览。
 * 编辑区带查找替换（Cmd/Ctrl+F）。渲染结果经 DOMPurify 清洗防止 XSS。
 */
export default function MarkdownTool({ instanceId }: ToolProps) {
  const [input, setInput] = usePersistentState(`md:${instanceId}:input`, SAMPLE);
  const [ratio, setRatio] = usePersistentState(`md:${instanceId}:ratio`, 0.5);
  const [mode, setMode] = usePersistentState<Mode>(`md:${instanceId}:mode`, "split");
  const previewRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const [tableOpen, setTableOpen] = useState(false);
  const [tableRaw, setTableRaw] = useState("");
  const [tableHeaders, setTableHeaders] = useState("");
  const [htmlOpen, setHtmlOpen] = useState(false);
  const [htmlSrc, setHtmlSrc] = useState("");

  const tablePreview = useMemo(() => {
    if (!tableRaw.trim()) return "";
    const cols = detectCols(tableRaw);
    if (cols < 2) return "";
    const headers = tableHeaders.trim()
      ? tableHeaders.split(",").map((h) => h.trim())
      : undefined;
    const t = parsePipeTable(tableRaw, { cols, headers });
    return toMarkdownTable(t.headers, t.rows);
  }, [tableRaw, tableHeaders]);

  function insertTable() {
    if (!tablePreview) {
      toast("未识别到表格（需至少 2 列的竖线分隔文本）", "error");
      return;
    }
    setInput((prev) => (prev.trim() ? prev + "\n\n" + tablePreview + "\n" : tablePreview + "\n"));
    setTableOpen(false);
    setTableRaw("");
    setTableHeaders("");
    toast("已插入表格", "success");
  }

  const html = useMemo(() => {
    const raw = marked.parse(input, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [input]);

  // 预览渲染后对代码块高亮（动态加载 highlight.js，避免进首屏）
  useEffect(() => {
    let cancelled = false;
    const el = document.querySelectorAll(".md-preview pre code");
    if (!el.length) return;
    import("highlight.js").then(({ default: hljs }) => {
      if (cancelled) return;
      document.querySelectorAll(".md-preview pre code").forEach((b) => {
        hljs.highlightElement(b as HTMLElement);
      });
    });
    return () => { cancelled = true; };
  }, [html]);

  const stats = useMemo(() => {
    const chars = input.length;
    const words = (input.trim().match(/\S+/g) || []).length;
    const minutes = Math.max(1, Math.round(words / 200));
    return { chars, words, minutes };
  }, [input]);

  function insertMd(snippet: string) {
    setInput((prev) => prev + (prev.endsWith("\n") || !prev ? "" : "\n") + snippet);
  }

  function insertToc() {
    const lines = input.split("\n");
    const tocLines: string[] = ["## 目录", ""];
    for (const line of lines) {
      const m = /^(#{1,4})\s+(.+)$/.exec(line.trim());
      if (!m) continue;
      const level = m[1].length;
      const text = m[2].replace(/[#*`~]/g, "").trim();
      const anchor = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, "-").replace(/^-|-$/g, "");
      const indent = "  ".repeat(level - 1);
      tocLines.push(`${indent}- [${text}](#${anchor})`);
    }
    if (tocLines.length === 2) {
      toast("未检测到标题行", "error");
      return;
    }
    tocLines.push("");
    setInput((prev) => tocLines.join("\n") + "\n" + prev);
    toast("已生成目录", "success");
  }

  function copyHtml() {
    copyText(html);
  }

  /** 把预览区导出为 PNG 图片，弹出保存对话框选择目录 */
  async function exportImage() {
    const el = previewRef.current;
    if (!el) return;
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const bg = getComputedStyle(el).backgroundColor || "#ffffff";
      const dataUrl = await toPng(el, {
        backgroundColor: bg,
        pixelRatio: 2,
        width: el.scrollWidth,
        height: el.scrollHeight,
        style: { overflow: "visible", height: "auto", maxHeight: "none" },
      });
      const { saveDataUrlWithDialog } = await import("../saveFile");
      const res = await saveDataUrlWithDialog(dataUrl, "markdown.png", [
        { name: "PNG 图片", extensions: ["png"] },
      ]);
      if (res.saved) {
        setExportMsg(`已保存到：${res.path}`);
        setTimeout(() => setExportMsg(""), 5000);
      }
    } catch (e) {
      console.error(e);
      setExportMsg(`导出失败：${(e as Error).message}`);
      setTimeout(() => setExportMsg(""), 5000);
    } finally {
      setExporting(false);
    }
  }

  async function exportMd() {
    const res = await saveTextWithDialog(input, "document.md", [{ name: "Markdown", extensions: ["md"] }]);
    if (res.saved) toast("已保存到 " + res.path, "success");
  }

  async function exportHtmlFile() {
    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
    const res = await saveTextWithDialog(doc, "document.html", [{ name: "HTML", extensions: ["html"] }]);
    if (res.saved) toast("已保存到 " + res.path, "success");
  }

  async function exportPdf() {
    const el = previewRef.current;
    if (!el) return;
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, { backgroundColor: "#ffffff", pixelRatio: 2, width: el.scrollWidth, height: el.scrollHeight, style: { overflow: "visible", height: "auto", maxHeight: "none" } });
      const { jsPDF } = await import("jspdf");
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error("图片加载失败")); });
      const pdf = new jsPDF({ unit: "px", format: [img.width, img.height] });
      pdf.addImage(dataUrl, "PNG", 0, 0, img.width, img.height);
      const blob = pdf.output("blob");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const { saveBinaryWithDialog } = await import("../saveFile");
      const res = await saveBinaryWithDialog(bytes, "document.pdf", [{ name: "PDF", extensions: ["pdf"] }]);
      if (res.saved) toast("已保存到 " + res.path, "success");
    } catch (e) {
      toast("导出失败：" + (e as Error).message, "error");
    } finally {
      setExporting(false);
    }
  }

  async function convertHtml() {
    if (!htmlSrc.trim()) return;
    try {
      const TurndownService = (await import("turndown")).default;
      const gfm = await import("@joplin/turndown-plugin-gfm");
      const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
      td.use(gfm.gfm);
      const md = td.turndown(htmlSrc);
      setInput((prev) => (prev.trim() ? prev + "\n\n" + md : md));
      setHtmlOpen(false);
      setHtmlSrc("");
      toast("已转换并插入", "success");
    } catch (e) {
      toast("转换失败：" + (e as Error).message, "error");
    }
  }

  const formatBar = (
    <div className="md-format-bar">
      <button onClick={() => insertMd("**粗体**")}>B</button>
      <button onClick={() => insertMd("*斜体*")}><em>I</em></button>
      <button onClick={() => insertMd("\n## 标题")}>H2</button>
      <button onClick={() => insertMd("\n- 列表项")}>列表</button>
      <button onClick={() => insertMd("\n> 引用")}>引用</button>
      <button onClick={() => insertMd("\n```\n代码\n```")}>代码块</button>
      <button onClick={() => insertMd("[文本](url)")}>链接</button>
      <button onClick={() => insertMd("\n| 列1 | 列2 |\n| --- | --- |\n| a | b |")}>表格</button>
      <span className="md-stats">{stats.chars} 字符 · {stats.words} 词 · 约 {stats.minutes} 分钟</span>
    </div>
  );

  const editor = (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {formatBar}
      <SearchableTextarea
        value={input}
        onChange={setInput}
        placeholder="在此编写 Markdown...（Cmd/Ctrl+F 查找，Cmd/Ctrl+R 替换）"
        showLineNumbers
      />
    </div>
  );
  // 可见预览（split/preview 模式展示）
  const preview = (
    <div className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />
  );
  // 始终存在的离屏预览，供任意模式下导出图片
  const exportTarget = (
    <div className="md-export-target" aria-hidden>
      <div
        className="md-preview"
        ref={previewRef}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );

  return (
    <div className="md-tool">
      <div className="md-toolbar">
        <div className="md-modes">
          <button
            className={mode === "edit" ? "on" : ""}
            onClick={() => setMode("edit")}
          >
            编辑
          </button>
          <button
            className={mode === "split" ? "on" : ""}
            onClick={() => setMode("split")}
          >
            编辑+预览
          </button>
          <button
            className={mode === "preview" ? "on" : ""}
            onClick={() => setMode("preview")}
          >
            预览
          </button>
        </div>
        <span className="md-sep" />
        <button onClick={copyHtml}>复制 HTML</button>
        <button onClick={exportImage} disabled={exporting}>
          {exporting ? "导出中…" : "导出图片"}
        </button>
        <button onClick={exportMd}>导出 .md</button>
        <button onClick={exportHtmlFile}>导出 .html</button>
        <button onClick={exportPdf} disabled={exporting}>导出 PDF</button>
        <button onClick={() => setInput("")}>清空</button>
        <button onClick={() => setInput(SAMPLE)}>示例</button>
        <button onClick={() => insertToc()} title="根据标题自动生成目录">📋 TOC</button>
        <button onClick={() => setTableOpen(true)} title="把数据库/运维查询结果转成 Markdown 表格">📥 查询结果转表格</button>
        <button onClick={() => setHtmlOpen(true)}>HTML→MD</button>
        {exportMsg && <span className="md-export-msg">{exportMsg}</span>}
      </div>
      <div className="md-panes">
        {mode === "edit" && editor}
        {mode === "preview" && preview}
        {mode === "split" && (
          <SplitPane
            ratio={ratio}
            onRatioChange={setRatio}
            left={editor}
            right={preview}
          />
        )}
      </div>
      {exportTarget}
      {tableOpen && (
        <div className="md-overlay" onClick={() => setTableOpen(false)}>
          <div className="md-modal" onClick={(e) => e.stopPropagation()}>
            <div className="md-modal-head">
              <span>查询结果 → Markdown 表格</span>
              <button onClick={() => setTableOpen(false)}>✕</button>
            </div>
            <div className="md-modal-body">
              <label className="md-modal-label">粘贴查询结果（竖线分隔，SQL 跨行会自动折叠）</label>
              <textarea
                className="md-modal-input"
                value={tableRaw}
                onChange={(e) => setTableRaw(e.target.value)}
                placeholder={"| 16264156 | user | SELECT ...\nFROM t | 286 |"}
                spellCheck={false}
              />
              <label className="md-modal-label">
                自定义表头（逗号分隔，留空用 列1/列2…）
                {tableRaw.trim() && detectCols(tableRaw) >= 2 ? ` · 探测到 ${detectCols(tableRaw)} 列` : ""}
              </label>
              <input
                className="md-modal-headers"
                value={tableHeaders}
                onChange={(e) => setTableHeaders(e.target.value)}
                placeholder="会话ID,用户名,地址,库名,操作类型,执行状态,SQL语句,耗时"
                spellCheck={false}
              />
              {tablePreview && (
                <>
                  <label className="md-modal-label">预览</label>
                  <pre className="md-modal-preview">{tablePreview}</pre>
                </>
              )}
            </div>
            <div className="md-modal-foot">
              <button onClick={() => { setTableRaw(""); setTableHeaders(""); }}>清空</button>
              <button className="md-modal-primary" onClick={insertTable} disabled={!tablePreview}>插入到编辑区</button>
            </div>
          </div>
        </div>
      )}
      {htmlOpen && (
        <div className="md-overlay" onClick={() => setHtmlOpen(false)}>
          <div className="md-modal" onClick={(e) => e.stopPropagation()}>
            <div className="md-modal-head">
              <span>HTML → Markdown</span>
              <button onClick={() => setHtmlOpen(false)}>✕</button>
            </div>
            <div className="md-modal-body">
              <label className="md-modal-label">粘贴 HTML 内容</label>
              <textarea
                className="md-modal-input"
                value={htmlSrc}
                onChange={(e) => setHtmlSrc(e.target.value)}
                placeholder="<h1>标题</h1><p>段落...</p>"
                spellCheck={false}
              />
            </div>
            <div className="md-modal-foot">
              <button onClick={() => { setHtmlSrc(""); }}>清空</button>
              <button className="md-modal-primary" onClick={convertHtml} disabled={!htmlSrc.trim()}>转换并插入</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
