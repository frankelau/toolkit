/** 查找相关的纯逻辑：构建正则、查找所有匹配区间 */

export interface SearchOptions {
  useRegex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
}

export interface MatchRange {
  start: number;
  end: number;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 根据查找词与选项构建全局正则；非法时返回 { error } */
export function buildRegex(
  find: string,
  opts: SearchOptions,
): { regex: RegExp | null; error: string } {
  if (!find) return { regex: null, error: "" };
  try {
    let pattern = opts.useRegex ? find : escapeRegExp(find);
    if (opts.wholeWord) pattern = `\\b(?:${pattern})\\b`;
    const flags = opts.caseSensitive ? "g" : "gi";
    return { regex: new RegExp(pattern, flags), error: "" };
  } catch (e) {
    return { regex: null, error: (e as Error).message };
  }
}

/** 查找文本中所有匹配区间 */
export function findMatches(text: string, regex: RegExp | null): MatchRange[] {
  if (!regex || !text) return [];
  const out: MatchRange[] = [];
  regex.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length });
    // 防止零宽匹配造成死循环
    if (m.index === regex.lastIndex) regex.lastIndex++;
  }
  return out;
}

/** HTML 转义，用于高亮层渲染 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * 解析替换串中的转义序列，使其能替换为换行/制表符等。
 * \n→换行 \t→制表 \r→回车 \0→空字符 \\→反斜杠
 */
export function unescapeReplacement(s: string): string {
  return s.replace(/\\([nrt0\\])/g, (_, c) => {
    switch (c) {
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      case "0":
        return "\0";
      case "\\":
        return "\\";
      default:
        return c;
    }
  });
}

/** 翻转字符串中每个字母的大小写（大↔小） */
export function flipCase(s: string): string {
  let out = "";
  for (const ch of s) {
    const lower = ch.toLowerCase();
    const upper = ch.toUpperCase();
    if (ch === lower && ch !== upper) out += upper;
    else if (ch === upper && ch !== lower) out += lower;
    else out += ch;
  }
  return out;
}

/**
 * 把文本按匹配区间切分为高亮 HTML。
 * current 为当前激活匹配的索引，使用不同的高亮类。
 * 末尾追加换行符以保证 backdrop 与 textarea 末行高度一致。
 */
export function buildHighlightHtml(
  text: string,
  matches: MatchRange[],
  current: number,
): string {
  if (matches.length === 0) return escapeHtml(text) + "\n";
  let html = "";
  let cursor = 0;
  matches.forEach((mt, i) => {
    html += escapeHtml(text.slice(cursor, mt.start));
    const cls = i === current ? "hl hl-current" : "hl";
    html += `<mark class="${cls}">${escapeHtml(text.slice(mt.start, mt.end))}</mark>`;
    cursor = mt.end;
  });
  html += escapeHtml(text.slice(cursor)) + "\n";
  return html;
}
