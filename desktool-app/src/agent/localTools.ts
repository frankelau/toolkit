import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import QRCode from "qrcode";
import type { AgentTool, ToolResult } from "./types";
import { queryDongchedi, queryYiche, queryPcauto } from "./carSpec";

/** 从 HTML 中提取搜索结果 */
function parseBingSearchResults(html: string): { title: string; url: string; snippet: string }[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const results: { title: string; url: string; snippet: string }[] = [];
  const items = doc.querySelectorAll("#b_results .b_algo");
  items.forEach((item, i) => {
    if (i >= 10) return;
    const link = item.querySelector("h2 a") as HTMLAnchorElement | null;
    const snippetEl = item.querySelector(".b_caption p") || item.querySelector(".b_lineclamp");
    if (link) {
      results.push({
        title: link.textContent?.trim() || "",
        url: link.href,
        snippet: snippetEl?.textContent?.trim() || "",
      });
    }
  });
  return results;
}

/** 从 Bing 图片搜索 HTML 中提取图片 */
function parseBingImageResults(html: string): { url: string; alt: string }[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const images: { url: string; alt: string }[] = [];
  // Bing 图片搜索结果在 .iuscp .imgpt a img
  const items = doc.querySelectorAll(".iuscp");
  items.forEach((item, i) => {
    if (i >= 20) return;
    const img = item.querySelector("img");
    if (img) {
      const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
      const alt = img.getAttribute("alt") || img.getAttribute("aria-label") || "";
      if (src && src.startsWith("http")) {
        images.push({ url: src, alt });
      }
    }
  });
  // 备用选择器
  if (images.length === 0) {
    const imgItems = doc.querySelectorAll(".mimg");
    imgItems.forEach((item, i) => {
      if (i >= 20) return;
      const src = (item as HTMLImageElement).src || item.getAttribute("data-src") || "";
      const alt = (item as HTMLImageElement).alt || "";
      if (src && src.startsWith("http")) {
        images.push({ url: src, alt });
      }
    });
  }
  return images;
}

/** 从 HTML 中提取正文文本 */
function extractTextFromHtml(html: string, selector?: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // 移除 script、style、nav、footer、header 等
  doc.querySelectorAll("script, style, nav, footer, header, aside, noscript, iframe").forEach(el => el.remove());
  const target = selector ? doc.querySelector(selector) : doc.body;
  if (!target) return "";
  // 提取文本，保留段落分隔
  const text = target.textContent || "";
  // 清理多余空白
  return text.replace(/\n{3,}/g, "\n\n").trim().slice(0, 8000);
}

/** 免费网页搜索 */
async function freeWebSearch(args: Record<string, unknown>): Promise<ToolResult> {
  const query = String(args.query || "");
  const count = Number(args.count) || 10;
  if (!query) return { text: "错误：缺少 query 参数" };
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${count}`;
    const resp = await tauriFetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });
    const html = await resp.text();
    const results = parseBingSearchResults(html);
    if (results.length === 0) {
      return { text: `未找到关于「${query}」的搜索结果。` };
    }
    const text = results.map((r, i) =>
      `${i + 1}. ${r.title}\n   ${r.snippet}\n   ${r.url}`
    ).join("\n\n");
    return { text: `搜索「${query}」的结果：\n\n${text}` };
  } catch (e) {
    return { text: `搜索失败：${e instanceof Error ? e.message : String(e)}` };
  }
}

/** 免费搜图 */
async function freeImageSearch(args: Record<string, unknown>): Promise<ToolResult> {
  const query = String(args.query || "");
  const count = Number(args.count) || 12;
  if (!query) return { text: "错误：缺少 query 参数" };
  try {
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&count=${count}`;
    const resp = await tauriFetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });
    const html = await resp.text();
    const images = parseBingImageResults(html);
    if (images.length === 0) {
      return { text: `未找到关于「${query}」的图片。` };
    }
    const text = images.map((r, i) => `${i + 1}. ${r.alt || "图片"}\n   ${r.url}`).join("\n");
    return { text: `搜图「${query}」的结果（${images.length} 张）：\n\n${text}`, images };
  } catch (e) {
    return { text: `搜图失败：${e instanceof Error ? e.message : String(e)}` };
  }
}

/** 网页内容提取 */
async function webFetch(args: Record<string, unknown>): Promise<ToolResult> {
  const url = String(args.url || "");
  const selector = args.selector ? String(args.selector) : undefined;
  if (!url) return { text: "错误：缺少 url 参数" };
  if (!url.startsWith("http")) return { text: "错误：URL 必须以 http 开头" };
  try {
    const resp = await tauriFetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });
    const html = await resp.text();
    const text = extractTextFromHtml(html, selector);
    if (!text) return { text: `无法从 ${url} 提取内容。` };
    return { text: `${url} 的内容：\n\n${text}` };
  } catch (e) {
    return { text: `网页获取失败：${e instanceof Error ? e.message : String(e)}` };
  }
}

/** 安全数学计算 */
async function calculate(args: Record<string, unknown>): Promise<ToolResult> {
  const expr = String(args.expression || "");
  if (!expr) return { text: "错误：缺少 expression 参数" };
  // 白名单：只允许数字、运算符、括号、小数点、空格
  if (!/^[\d+\-*/().%\s]+$/.test(expr)) {
    return { text: "错误：表达式包含不允许的字符。只支持 + - * / ( ) % 和数字。" };
  }
  try {
    // 用 Function 构造器（已通过白名单过滤）
    // eslint-disable-next-line no-new-func
    const fn = new Function(`"use strict"; return (${expr})`);
    const result = fn();
    if (typeof result !== "number" || !isFinite(result)) {
      return { text: `计算结果无效：${result}` };
    }
    return { text: `${expr} = ${result}` };
  } catch (e) {
    return { text: `计算失败：${e instanceof Error ? e.message : String(e)}` };
  }
}

/** 读剪贴板 */
async function readClipboard(): Promise<ToolResult> {
  try {
    const text = await navigator.clipboard.readText();
    return { text: `剪贴板内容：\n${text}` };
  } catch {
    return { text: "无法读取剪贴板，可能需要用户授权。" };
  }
}

/** 写剪贴板 */
async function writeClipboard(args: Record<string, unknown>): Promise<ToolResult> {
  const text = String(args.text || "");
  if (!text) return { text: "错误：缺少 text 参数" };
  try {
    await navigator.clipboard.writeText(text);
    return { text: `已将 ${text.length} 字符写入剪贴板。` };
  } catch {
    return { text: "写入剪贴板失败。" };
  }
}

/** 获取当前时间 */
async function getCurrentTime(): Promise<ToolResult> {
  const now = new Date();
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const dateStr = now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return {
    text: `当前时间：${dateStr} 星期${weekdays[now.getDay()]} ${timeStr}\n时间戳：${Math.floor(now.getTime() / 1000)}`,
  };
}

/** 生成二维码 */
async function generateQrcode(args: Record<string, unknown>): Promise<ToolResult> {
  const text = String(args.text || "");
  const size = Number(args.size) || 256;
  if (!text) return { text: "错误：缺少 text 参数" };
  try {
    const dataUrl = await QRCode.toDataURL(text, { width: size, margin: 1 });
    const html = `<div style="text-align:center"><img src="${dataUrl}" alt="QR Code" style="max-width:${size}px;width:100%;border-radius:8px" /></div>`;
    return { text: `已生成二维码，内容：${text}`, ui: html };
  } catch (e) {
    return { text: `二维码生成失败：${e instanceof Error ? e.message : String(e)}` };
  }
}

/** 从百度搜索 HTML 中提取结果 */
function parseBaiduResults(html: string): { title: string; url: string; snippet: string }[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const results: { title: string; url: string; snippet: string }[] = [];
  const items = doc.querySelectorAll(".result.c-container, .result-op.c-container");
  items.forEach((item, i) => {
    if (i >= 10) return;
    const link = item.querySelector("h3 a") as HTMLAnchorElement | null;
    const snippetEl = item.querySelector(".c-abstract, .c-span-last, [class*='content-right']");
    if (link) {
      results.push({
        title: link.textContent?.trim() || "",
        url: link.href,
        snippet: snippetEl?.textContent?.trim() || "",
      });
    }
  });
  return results;
}

/** 从神马搜索 HTML 中提取结果 */
function parseShenmaResults(html: string): { title: string; url: string; snippet: string }[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const results: { title: string; url: string; snippet: string }[] = [];
  const items = doc.querySelectorAll(".result, .res-item, [class*='search-result']");
  items.forEach((item, i) => {
    if (i >= 10) return;
    const link = item.querySelector("a.title, .title a, a[tg-title]") as HTMLAnchorElement | null
      || item.querySelector("a") as HTMLAnchorElement | null;
    const snippetEl = item.querySelector(".abstract, .desc, [class*='content']");
    if (link && link.textContent?.trim()) {
      results.push({
        title: link.textContent.trim(),
        url: link.href,
        snippet: snippetEl?.textContent?.trim() || "",
      });
    }
  });
  return results;
}

const SEARCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

/** 格式化搜索结果 */
// function formatResults(query: string, engine: string, results: { title: string; url: string; snippet: string }[]): string {
//   if (results.length === 0) return `未找到关于「${query}」的搜索结果（${engine}）。`;
//   const text = results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   ${r.url}`).join("\n\n");
//   return `搜索「${query}」的结果（${engine}）：\n\n${text}`;
// }

/** 百度搜索 */
export async function baiduSearch(query: string, count = 10): Promise<{ title: string; url: string; snippet: string }[]> {
  const url = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}&rn=${count}`;
  const resp = await tauriFetch(url, { headers: SEARCH_HEADERS });
  return parseBaiduResults(await resp.text());
}

/** 神马（阿里）搜索 */
export async function shenmaSearch(query: string, count = 10): Promise<{ title: string; url: string; snippet: string }[]> {
  const url = `https://m.sm.cn/s?q=${encodeURIComponent(query)}&from=0&num=${count}`;
  const resp = await tauriFetch(url, { headers: SEARCH_HEADERS });
  return parseShenmaResults(await resp.text());
}

/** Bing 搜索（导出供外部调用） */
export async function bingSearch(query: string, count = 10): Promise<{ title: string; url: string; snippet: string }[]> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${count}`;
  const resp = await tauriFetch(url, { headers: SEARCH_HEADERS });
  return parseBingSearchResults(await resp.text());
}

/** 所有本地工具定义 */
export const LOCAL_TOOLS: AgentTool[] = [
  {
    id: "local:free_web_search",
    name: "free_web_search",
    description: "搜索互联网获取信息。不需要 API Key，通过抓取 Bing 搜索结果实现。返回标题、摘要和链接。",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词" },
        count: { type: "number", description: "结果数量，默认 10", default: 10 },
      },
      required: ["query"],
    },
    source: "local",
    execute: freeWebSearch,
  },
  {
    id: "local:free_image_search",
    name: "free_image_search",
    description: "搜索互联网图片。不需要 API Key，通过抓取 Bing 图片搜索实现。返回图片 URL 列表。",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜图关键词" },
        count: { type: "number", description: "图片数量，默认 12", default: 12 },
      },
      required: ["query"],
    },
    source: "local",
    execute: freeImageSearch,
  },
  {
    id: "local:web_fetch",
    name: "web_fetch",
    description: "获取指定网页的内容并提取正文文本。适用于阅读文章、查看详情页等场景。",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "要获取的网页 URL" },
        selector: { type: "string", description: "可选 CSS 选择器，只提取匹配元素的内容" },
      },
      required: ["url"],
    },
    source: "local",
    execute: webFetch,
  },
  {
    id: "local:calculate",
    name: "calculate",
    description: "数学计算器。支持加减乘除、括号、百分号。例如：(100000 * 0.045 * 30) / 12",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "数学表达式" },
      },
      required: ["expression"],
    },
    source: "local",
    execute: calculate,
  },
  {
    id: "local:read_clipboard",
    name: "read_clipboard",
    description: "读取系统剪贴板内容。",
    inputSchema: { type: "object", properties: {} },
    source: "local",
    execute: readClipboard,
  },
  {
    id: "local:write_clipboard",
    name: "write_clipboard",
    description: "将文本写入系统剪贴板。",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "要写入的文本" } },
      required: ["text"],
    },
    source: "local",
    execute: writeClipboard,
  },
  {
    id: "local:get_current_time",
    name: "get_current_time",
    description: "获取当前日期、时间、星期和时间戳。",
    inputSchema: { type: "object", properties: {} },
    source: "local",
    execute: getCurrentTime,
  },
  {
    id: "local:generate_qrcode",
    name: "generate_qrcode",
    description: "为指定文本生成二维码图片。",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "要编码的文本" },
        size: { type: "number", description: "图片尺寸（像素），默认 256" },
      },
      required: ["text"],
    },
    source: "local",
    execute: generateQrcode,
  },
  {
    id: "local:car_spec_dongchedi",
    name: "car_spec_dongchedi",
    description: "从懂车帝查询指定车系的完整参配数据，包含发动机、变速箱、底盘、尺寸、安全配置等。用于车型参数对比、配置查询。",
    inputSchema: {
      type: "object",
      properties: { car_name: { type: "string", description: "车系名称，如「比亚迪海豹」「宝马3系」" } },
      required: ["car_name"],
    },
    source: "local",
    execute: (args) => queryDongchedi(String(args["car_name"] || "")),
  },
  {
    id: "local:car_spec_yiche",
    name: "car_spec_yiche",
    description: "从易车网查询指定车系的完整参配数据，包含所有车款的详细参数。用于车型参数对比、配置查询。",
    inputSchema: {
      type: "object",
      properties: { car_name: { type: "string", description: "车系名称，如「比亚迪海豹」「宝马3系」" } },
      required: ["car_name"],
    },
    source: "local",
    execute: (args) => queryYiche(String(args["car_name"] || "")),
  },
  {
    id: "local:car_spec_pcauto",
    name: "car_spec_pcauto",
    description: "从太平洋汽车查询指定车系的完整参配数据，包含所有车款的详细参数。用于车型参数对比、配置查询。",
    inputSchema: {
      type: "object",
      properties: { car_name: { type: "string", description: "车系名称，如「比亚迪海豹」「宝马3系」" } },
      required: ["car_name"],
    },
    source: "local",
    execute: (args) => queryPcauto(String(args["car_name"] || "")),
  },
];
