// markdown.ts — 增强版 Markdown 渲染引擎
// 对齐 cc-gui MarkdownBlock 的核心算法 + utils/markdown.ts

import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import DOMPurify from "dompurify";

// ─── 安全 Href 校验 ──────────────────────────────────────────────────────────
const SAFE_HREF_PROTOCOL_REGEX = /^(?:https?|mailto):/i;
const FILE_URI_SCHEME_REGEX = /^file:/i;
const WINDOWS_DRIVE_PATH_REGEX = /^[A-Za-z]:[\\/]/;
const URI_SCHEME_REGEX = /^[A-Za-z][A-Za-z0-9+.-]*:/;
let hrefSanitizerHookInstalled = false;

function containsControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) < 0x20) return true;
  }
  return false;
}

function isAllowedHrefValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (containsControlCharacter(trimmed)) return false;
  if (WINDOWS_DRIVE_PATH_REGEX.test(trimmed)) return true;
  if (FILE_URI_SCHEME_REGEX.test(trimmed)) return true;
  if (!URI_SCHEME_REGEX.test(trimmed)) return true;
  return SAFE_HREF_PROTOCOL_REGEX.test(trimmed);
}

export function ensureSafeHrefSanitizerHook(): void {
  if (hrefSanitizerHookInstalled) return;
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName !== "href" || typeof data.attrValue !== "string") return;
    if (isAllowedHrefValue(data.attrValue)) { data.forceKeepAttr = true; return; }
    data.keepAttr = false;
  });
  hrefSanitizerHookInstalled = true;
}

// ─── Highlight.js 注册 ───────────────────────────────────────────────────────
let hljsRegistered = false;
export function registerHighlightLanguages(): void {
  if (hljsRegistered) return;
  // highlight.js 已通过 npm 安装，自动注册所有常用语言
  hljs.registerAliases(["js", "jsx"], { languageName: "javascript" });
  hljs.registerAliases(["ts", "tsx"], { languageName: "typescript" });
  hljs.registerAliases(["sh", "zsh"], { languageName: "bash" });
  hljs.registerAliases(["html", "xhtml", "svg"], { languageName: "xml" });
  hljs.registerAliases(["yml"], { languageName: "yaml" });
  hljsRegistered = true;
}

// ─── marked 配置 ─────────────────────────────────────────────────────────────
let markedConfigured = false;
export function configureMarked(): void {
  if (markedConfigured) return;
  registerHighlightLanguages();
  ensureSafeHrefSanitizerHook();

  marked.use(
    markedHighlight({
      highlight(code: string, lang: string) {
        if (lang === "mermaid") return code;
        if (lang && hljs.getLanguage(lang)) {
          try { return hljs.highlight(code, { language: lang }).value; } catch {}
        }
        return hljs.highlightAuto(code).value;
      },
    })
  );

  marked.setOptions({ breaks: false, gfm: true });
  markedConfigured = true;
}

// ─── Href 安全 DOMPurify 选项 ────────────────────────────────────────────────
const MARKDOWN_LINK_SANITIZE_OPTIONS = { ALLOW_UNKNOWN_PROTOCOLS: true } as const;

// ─── Mermaid 关键词 ──────────────────────────────────────────────────────────
const MERMAID_KEYWORDS = new Set([
  "flowchart", "graph", "sequencediagram", "classdiagram",
  "statediagram", "statediagram-v2", "erdiagram", "journey",
  "gantt", "pie", "quadrantchart", "requirementdiagram",
  "gitgraph", "mindmap", "timeline", "zenuml", "sankey",
  "xychart", "xychart-beta", "block-beta",
]);

const MERMAID_FENCE_REGEX = /```mermaid[\s\S]*?```/i;
const MERMAID_KEYWORD_REGEX = new RegExp(
  `(^|\\n)\\s*(?:${[...MERMAID_KEYWORDS].join("|")})\\b`, "i"
);

export function hasPossibleMermaidContent(content: string): boolean {
  if (!content) return false;
  return MERMAID_FENCE_REGEX.test(content) || MERMAID_KEYWORD_REGEX.test(content);
}

export function isMermaidKeyword(word: string): boolean {
  return MERMAID_KEYWORDS.has(word.toLowerCase());
}

// ─── 系统标签清理 ─────────────────────────────────────────────────────────────
const SYSTEM_XML_TAGS_RE = /<(commit_analysis|context|function_analysis|pr_analysis)>[\s\S]*?<\/\1>\n?/g;

export function stripSystemTags(content: string): string {
  const result = content.replace(SYSTEM_XML_TAGS_RE, "");
  return result !== content ? result.trim() : result;
}

// ─── XML 标签转义 ────────────────────────────────────────────────────────────
const XML_TAG_RE = /<!--[\s\S]*?-->|<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^>]*)?\/?>/g;
const CODE_FENCE_RE = /(```[\s\S]*?```)/g;
const INLINE_CODE_RE = /(`[^`\n]+`)/g;

export function escapeXmlTags(text: string): string {
  return text.replace(XML_TAG_RE, (match) =>
    match.replace(/</g, "&lt;").replace(/>/g, "&gt;")
  );
}

export function stripAndEscapeOutsideCodeBlocks(content: string): string {
  const fenceParts = content.split(CODE_FENCE_RE);
  return fenceParts
    .map((fencePart, fenceIdx) => {
      if (fenceIdx % 2 === 1) return fencePart;
      const inlineParts = fencePart.split(INLINE_CODE_RE);
      return inlineParts
        .map((inlinePart, inlineIdx) => {
          if (inlineIdx % 2 === 1) return inlinePart;
          return escapeXmlTags(stripSystemTags(inlinePart));
        })
        .join("");
    })
    .join("");
}

// ─── 流式安全 ────────────────────────────────────────────────────────────────
export function makeStreamSafe(content: string): string {
  if (!content) return content;
  let result = content;
  const lines = result.split("\n");
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) inCodeBlock = !inCodeBlock;
  }
  if (inCodeBlock) result += "\n```";

  const lastNewlineIndex = result.lastIndexOf("\n");
  const lastLine = lastNewlineIndex >= 0 ? result.slice(lastNewlineIndex + 1) : result;
  const singleBacktickMatches = lastLine.match(/(?<!`)`(?!`)/g);
  if (singleBacktickMatches && singleBacktickMatches.length % 2 !== 0) {
    result += "`";
  }
  return result;
}

// ─── 流式渲染（轻量级，流式期间用） ──────────────────────────────────────────
const BOLD_SYNTAX_RE = /(\*\*[^*]+\*\*)/g;

function renderStreamingInlineText(text: string, handleInlineCode = true): string {
  if (handleInlineCode) {
    return text.split(INLINE_CODE_RE).map((part) => {
      const m = /^`([^`\n]+)`$/.exec(part);
      if (m) return `<code>${m[1]}</code>`;
      return part.split(BOLD_SYNTAX_RE).map((p) => {
        const bm = /^\*\*([^*]+)\*\*$/.exec(p);
        if (bm) return `<strong>${bm[1]}</strong>`;
        return p;
      }).join("");
    }).join("");
  }
  return text.split(BOLD_SYNTAX_RE).map((p) => {
    const bm = /^\*\*([^*]+)\*\*$/.exec(p);
    if (bm) return `<strong>${bm[1]}</strong>`;
    return p;
  }).join("");
}

function safeLang(lang: string): string {
  return lang.replace(/[^a-zA-Z0-9_.-]/g, "");
}

export function renderStreamingContent(content: string): string {
  if (!content) return "";
  const safeContent = makeStreamSafe(content);
  const segments: string[] = [];
  let current = "";
  let inCode = false;
  let codeLang = "";

  for (const line of safeContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      if (!inCode) {
        if (current) segments.push(current);
        current = "";
        inCode = true;
        codeLang = safeLang(trimmed.slice(3).trim());
      } else {
        const escaped = current.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        segments.push(`<pre><code${codeLang ? ` class="language-${codeLang}"` : ""}>${escaped}</code></pre>`);
        current = "";
        inCode = false;
        codeLang = "";
      }
      continue;
    }
    current += (current ? "\n" : "") + line;
  }

  if (current) {
    if (inCode) {
      const escaped = current.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      segments.push(`<pre><code${codeLang ? ` class="language-${codeLang}"` : ""}>${escaped}</code></pre>`);
    } else {
      segments.push(current);
    }
  }

  const raw = segments.map((seg) => {
    if (seg.startsWith("<pre>")) return seg;
    const cleaned = stripSystemTags(seg);
    const inlineParts = cleaned.split(INLINE_CODE_RE);
    const processed = inlineParts.map((part, idx) => {
      if (idx % 2 === 1) return `<code>${part.slice(1, -1)}</code>`;
      return renderStreamingInlineText(escapeXmlTags(part), false);
    }).join("");
    return processed.split(/\n{2,}/).filter(Boolean).map((block) => {
      const hm = /^(#{1,6})\s+(.+)$/.exec(block);
      if (hm && !block.includes("\n")) return `<h${hm[1].length}>${hm[2]}</h${hm[1].length}>`;
      return `<p>${block.split("\n").join("<br/>")}</p>`;
    }).join("");
  }).join("");

  return DOMPurify.sanitize(raw, {
    ...MARKDOWN_LINK_SANITIZE_OPTIONS,
    ALLOWED_TAGS: ["a", "p", "br", "pre", "code", "strong", "h1", "h2", "h3", "h4", "h5", "h6"],
    ALLOWED_ATTR: ["class", "href"],
  });
}

// ─── 完整渲染（非流式） ──────────────────────────────────────────────────────
export function renderMarkdownFull(content: string): string {
  configureMarked();
  if (!content) return "";
  try {
    const trimmed = content.replace(/[\r\n]+$/, "");
    const cleaned = stripAndEscapeOutsideCodeBlocks(trimmed);
    const parsed = marked.parse(cleaned);
    const sanitized = DOMPurify.sanitize(
      typeof parsed === "string" ? parsed : String(parsed),
      { ...MARKDOWN_LINK_SANITIZE_OPTIONS, ADD_ATTR: ["class", "data-lang"] }
    );
    return sanitized.trim();
  } catch {
    return content.replace(/[&<>"']/g, (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!)
    );
  }
}

// ─── 简化版（保留向后兼容） ──────────────────────────────────────────────────
export function renderMd(text: string): string {
  configureMarked();
  return renderMarkdownFull(text);
}
