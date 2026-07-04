/**
 * SSE / 流式响应解析共享工具。
 * 两个分析工具（SseAnalyzer、StreamAnalyzer）共用此处的解析与路径抽取逻辑。
 */

/** 一条 SSE 事件（按空行分隔的事件块解析而来） */
export interface SseEvent {
  /** 序号，从 1 开始 */
  n: number;
  /** event: 字段，缺省视为 "message" */
  event?: string;
  /** id: 字段 */
  id?: string;
  /** retry: 字段（毫秒） */
  retry?: number;
  /** 合并后的 data 字段（多行 data: 用 \n 连接） */
  data: string;
  /** 以 ":" 开头的注释行内容 */
  comment?: string;
  /** data 解析为 JSON 后的对象（解析失败为 undefined） */
  json?: unknown;
}

/** 流式记录（按行解析的 NDJSON / 原始分块） */
export interface StreamRecord {
  n: number;
  /** 原始行文本（已去掉可能的 data: 前缀） */
  raw: string;
  /** 解析为 JSON 后的对象（失败为 undefined） */
  json?: unknown;
  /** 是否为 [DONE] 之类的终止标记 */
  done?: boolean;
}

/** 尝试把字符串解析为 JSON，失败返回 undefined */
export function tryJson(s: string): unknown {
  const t = s.trim();
  if (!t || (t[0] !== "{" && t[0] !== "[")) return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
}

/**
 * 按路径从对象取值。路径用 "/" 或 "." 分隔，支持数组下标。
 * 例：`choices/0/delta/content`、`delta.text`。
 */
export function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split(/[/.]/).map((p) => p.trim()).filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/** 把任意值转成可拼接的字符串（对象/数组转 JSON） */
export function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

/**
 * 解析 SSE 文本为事件数组。事件之间以空行分隔，
 * 每行形如 `field: value`，data 字段可多行（用 \n 连接）。
 */
export function parseSse(raw: string): SseEvent[] {
  const events: SseEvent[] = [];
  const blocks = raw.replace(/\r\n/g, "\n").split(/\n[ \t]*\n+/);
  let n = 0;
  for (const block of blocks) {
    if (!block.trim()) continue;
    const ev: SseEvent = { n: 0, data: "" };
    const dataLines: string[] = [];
    let hasField = false;
    for (const line of block.split("\n")) {
      if (line === "") continue;
      if (line.startsWith(":")) {
        ev.comment = (ev.comment ? ev.comment + "\n" : "") + line.slice(1).trim();
        hasField = true;
        continue;
      }
      const ci = line.indexOf(":");
      const field = ci === -1 ? line : line.slice(0, ci);
      let value = ci === -1 ? "" : line.slice(ci + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      switch (field) {
        case "event": ev.event = value; hasField = true; break;
        case "data": dataLines.push(value); hasField = true; break;
        case "id": ev.id = value; hasField = true; break;
        case "retry": { const r = Number(value); if (!Number.isNaN(r)) ev.retry = r; hasField = true; break; }
        default: break; // 未知字段忽略
      }
    }
    if (!hasField) continue;
    ev.n = ++n;
    ev.data = dataLines.join("\n");
    ev.json = tryJson(ev.data);
    events.push(ev);
  }
  return events;
}

/**
 * 解析流式响应为逐行记录。自动剥离行首的 `data:` 前缀，
 * 识别 `[DONE]` 终止标记，逐行尝试 JSON 解析（适配 NDJSON / JSON Lines）。
 */
export function parseStream(raw: string): StreamRecord[] {
  const records: StreamRecord[] = [];
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  let n = 0;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith(":")) continue; // SSE 注释/心跳
    let body = t;
    if (body.startsWith("data:")) body = body.slice(5).trim();
    const done = body === "[DONE]";
    records.push({ n: ++n, raw: body, json: done ? undefined : tryJson(body), done });
  }
  return records;
}

/** 按路径抽取并拼接所有记录的字段值，用于还原流式增量内容（简单模式） */
export function assemble(items: { json?: unknown }[], path: string): string {
  if (!path.trim()) return "";
  let out = "";
  for (const it of items) {
    if (it.json === undefined) continue;
    const v = getByPath(it.json, path);
    if (v !== undefined) out += asText(v);
  }
  return out;
}

/* ───────────────────────── 高级规则引擎 ─────────────────────────
 * 让拼接支持更复杂的场景：
 *  - 先过滤后拼接：规则只匹配满足条件的事件/记录；
 *  - 按不同条件抽取不同字段：多条规则各带自己的「条件 + 抽取路径」，
 *    每条记录命中第一条满足条件的规则，按该规则的路径抽取。
 */

/** 解析/抽取的归一化条目，两个分析器都映射成它 */
export interface StreamItem {
  /** data/行 解析后的 JSON（失败为 undefined） */
  json?: unknown;
  /** 原始文本（SSE 的 data、流式的整行） */
  text: string;
  /** SSE 的 event 名（流式无） */
  event?: string;
}

/** 条件运算符 */
export type CondOp = "any" | "exists" | "missing" | "eq" | "ne" | "contains" | "regex";

export const COND_OP_LABELS: Record<CondOp, string> = {
  any: "全部（不过滤）",
  exists: "字段存在",
  missing: "字段不存在",
  eq: "等于",
  ne: "不等于",
  contains: "包含",
  regex: "正则匹配",
};

/** 一条抽取规则：满足条件的条目按 extractPath 抽取字段拼接 */
export interface ExtractRule {
  id: string;
  enabled: boolean;
  /** 条件字段路径；"" = 原文，"$event" = SSE 事件名 */
  condField: string;
  condOp: CondOp;
  /** eq/ne/contains/regex 的比较值 */
  condValue: string;
  /** 抽取字段路径；"" = 原文 */
  extractPath: string;
  /** 拼接到结果前先插入的分隔串（支持 \n \t 转义），可空 */
  sep?: string;
}

/** 取归一化条目上某路径的值。"" = 原文；"$event" = 事件名；否则按 json 路径取 */
export function resolveField(item: StreamItem, field: string): unknown {
  const f = field.trim();
  if (f === "") return item.text;
  if (f === "$event") return item.event ?? "message";
  if (item.json === undefined) return undefined;
  return getByPath(item.json, f);
}

/** 判断条目是否满足规则条件 */
export function matchRule(item: StreamItem, rule: ExtractRule): boolean {
  if (rule.condOp === "any") return true;
  const v = resolveField(item, rule.condField);
  if (rule.condOp === "exists") return v !== undefined && v !== null;
  if (rule.condOp === "missing") return v === undefined || v === null;
  const s = asText(v);
  switch (rule.condOp) {
    case "eq": return s === rule.condValue;
    case "ne": return s !== rule.condValue;
    case "contains": return s.includes(rule.condValue);
    case "regex":
      try { return new RegExp(rule.condValue).test(s); } catch { return false; }
    default: return false;
  }
}

/** 把 \n \t \r 等转义序列还原为真实字符（用于分隔串） */
function unescapeSep(s: string): string {
  return s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\r/g, "\r");
}

/** 返回命中该条目的规则下标（按顺序取第一条启用且满足条件的），无则 -1 */
export function matchedRuleIndex(item: StreamItem, rules: ExtractRule[]): number {
  for (let i = 0; i < rules.length; i++) {
    if (rules[i].enabled && matchRule(item, rules[i])) return i;
  }
  return -1;
}

/** 按命中规则抽取单个条目的文本（用于列表「转换后」视图）；未命中返回 undefined */
export function extractItemText(item: StreamItem, rules: ExtractRule[]): string | undefined {
  const i = matchedRuleIndex(item, rules);
  if (i === -1) return undefined;
  const v = resolveField(item, rules[i].extractPath);
  return v === undefined ? undefined : asText(v);
}

/** 按规则集过滤并拼接，还原流式内容（高级模式） */
export function assembleWithRules(items: StreamItem[], rules: ExtractRule[]): string {
  const active = rules.filter((r) => r.enabled);
  if (active.length === 0) return "";
  let out = "";
  for (const it of items) {
    const i = matchedRuleIndex(it, rules);
    if (i === -1) continue;
    const rule = rules[i];
    const v = resolveField(it, rule.extractPath);
    if (v === undefined) continue;
    if (rule.sep) out += unescapeSep(rule.sep);
    out += asText(v);
  }
  return out;
}

/** 新建一条默认规则 */
export function newRule(extractPath = ""): ExtractRule {
  return {
    id: Math.random().toString(36).slice(2, 9),
    enabled: true,
    condField: "",
    condOp: "any",
    condValue: "",
    extractPath,
    sep: "",
  };
}
