import { useMemo, useState } from "react";
import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import { copyText } from "../useCopyFeedback";
import "./RegexTool.css";
import LineNumberedArea from "../components/LineNumberedArea";

interface Pattern { label: string; pattern: string; desc: string; }
interface Group { title: string; items: Pattern[]; }

const GROUPS: Group[] = [
  {
    title: "验证",
    items: [
      { label: "邮箱", pattern: "^[\\w.+-]+@[\\w-]+\\.[\\w.]{2,}$", desc: "标准邮箱地址" },
      { label: "手机号(中国)", pattern: "^1[3-9]\\d{9}$", desc: "11位手机号" },
      { label: "URL", pattern: "^https?:\\/\\/[\\w\\-.]+(:\\d+)?(\\/[^\\s]*)?$", desc: "http/https URL" },
      { label: "IPv4", pattern: "^(\\d{1,3}\\.){3}\\d{1,3}$", desc: "IPv4 地址" },
      { label: "IPv6", pattern: "^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$", desc: "IPv6 地址（完整）" },
      { label: "身份证", pattern: "^\\d{17}[\\dX]$", desc: "18位中国身份证" },
      { label: "邮政编码", pattern: "^\\d{6}$", desc: "6位邮编" },
      { label: "整数", pattern: "^-?\\d+$", desc: "正负整数" },
      { label: "浮点数", pattern: "^-?\\d+(\\.\\d+)?$", desc: "正负浮点数" },
      { label: "十六进制颜色", pattern: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", desc: "#RGB 或 #RRGGBB" },
    ],
  },
  {
    title: "提取",
    items: [
      { label: "中文字符", pattern: "[\\u4e00-\\u9fa5]+", desc: "连续中文字" },
      { label: "英文单词", pattern: "[a-zA-Z]+", desc: "连续英文字母" },
      { label: "数字序列", pattern: "\\d+", desc: "连续数字" },
      { label: "HTML 标签", pattern: "<[^>]+>", desc: "任意 HTML 标签" },
      { label: "HTML 标签内容", pattern: "<(\\w+)[^>]*>([\\s\\S]*?)<\\/\\1>", desc: "匹配配对标签及内容" },
      { label: "URL 参数", pattern: "[?&]([\\w]+)=([^&]*)", desc: "提取查询参数 key=value" },
      { label: "时间 HH:MM:SS", pattern: "\\d{2}:\\d{2}:\\d{2}", desc: "时间格式" },
      { label: "日期 YYYY-MM-DD", pattern: "\\d{4}-\\d{2}-\\d{2}", desc: "ISO 日期格式" },
    ],
  },
  {
    title: "格式化",
    items: [
      { label: "去首尾空格", pattern: "^\\s+|\\s+$", desc: "替换为空字符串" },
      { label: "多空白合并", pattern: "\\s{2,}", desc: "替换为单个空格" },
      { label: "空行", pattern: "^\\s*$", desc: "多模式下匹配空行" },
      { label: "重复单词", pattern: "\\b(\\w+) \\1\\b", desc: "匹配连续重复单词" },
      { label: "千位分隔符", pattern: "(?<=\\d)(?=(\\d{3})+$)", desc: "在正确位置插入逗号" },
    ],
  },
  {
    title: "特殊字符",
    items: [
      { label: ". 任意字符", pattern: ".", desc: "除换行外任意字符" },
      { label: "\\w 单词字符", pattern: "\\w", desc: "[a-zA-Z0-9_]" },
      { label: "\\d 数字", pattern: "\\d", desc: "[0-9]" },
      { label: "\\s 空白", pattern: "\\s", desc: "空格/Tab/换行" },
      { label: "^ 行首", pattern: "^", desc: "字符串或行的开头" },
      { label: "$ 行尾", pattern: "$", desc: "字符串或行的结尾" },
      { label: "\\b 词边界", pattern: "\\b", desc: "单词与非单词间的位置" },
      { label: "(?=...) 正向预查", pattern: "foo(?=bar)", desc: "foo 后跟 bar（不消费）" },
      { label: "(?!...) 负向预查", pattern: "foo(?!bar)", desc: "foo 后不跟 bar" },
    ],
  },
];

const FLAG_LIST = ["g","i","m","s","u","y"] as const;
const FLAG_LABELS: Record<string, string> = {
  g: "全局", i: "忽略大小写", m: "多行", s: ". 匹配换行", u: "Unicode", y: "粘性",
};

function buildHighlightedText(text: string, re: RegExp): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  const safeRe = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  safeRe.lastIndex = 0;
  let m: RegExpExecArray | null;
  let g = 0;
  while ((m = safeRe.exec(text)) !== null && g++ < 1000) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<mark key={`${m.index}-${g}`} className="rx-hl">{m[0]}</mark>);
    last = m.index + m[0].length;
    if (!m[0].length) safeRe.lastIndex++;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function buildSnippet(pattern: string, flagStr: string, lang: "js"|"python"|"java"): string {
  const esc = pattern.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/'/g, "\\'");
  if (lang === "js") {
    return `const re = /${pattern}/${flagStr};\nconst result = re.exec(text);\n// or: text.match(re)`;
  }
  if (lang === "python") {
    const pyFlags = flagStr.includes("i") ? ", re.IGNORECASE" : "";
    const multiline = flagStr.includes("m") ? " | re.MULTILINE" : "";
    return `import re\npattern = re.compile(r'${esc}'${pyFlags}${multiline})\nresult = pattern.findall(text)`;
  }
  const jFlags = [flagStr.includes("i") ? "Pattern.CASE_INSENSITIVE" : "", flagStr.includes("m") ? "Pattern.MULTILINE" : ""].filter(Boolean).join(" | ") || "0";
  return `Pattern pattern = Pattern.compile("${esc.replace(/"/g, '\\"')}", ${jFlags});\nMatcher matcher = pattern.matcher(text);\nwhile (matcher.find()) { System.out.println(matcher.group()); }`;
}

type Token = { text: string; desc: string };

function explainRegex(pattern: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "\\") {
      const next = pattern[i + 1] ?? "";
      const ESCAPES: Record<string, string> = {
        d: "数字 [0-9]", D: "非数字", w: "单词字符 [a-zA-Z0-9_]", W: "非单词字符",
        s: "空白字符", S: "非空白字符", b: "词边界", B: "非词边界",
        n: "换行", t: "Tab", r: "回车", "0": "空字符",
      };
      tokens.push({ text: c + next, desc: ESCAPES[next] ?? `转义字符 '${next}'` });
      i += 2; continue;
    }
    if (c === ".") { tokens.push({ text: c, desc: "任意字符（除换行）" }); i++; continue; }
    if (c === "^") { tokens.push({ text: c, desc: "行首/字符串开头" }); i++; continue; }
    if (c === "$") { tokens.push({ text: c, desc: "行尾/字符串末尾" }); i++; continue; }
    if (c === "*") { tokens.push({ text: c, desc: "0次或多次" }); i++; continue; }
    if (c === "+") { tokens.push({ text: c, desc: "1次或多次" }); i++; continue; }
    if (c === "?") { tokens.push({ text: c, desc: "0次或1次（或非贪婪）" }); i++; continue; }
    if (c === "|") { tokens.push({ text: c, desc: "或" }); i++; continue; }
    if (c === "[") {
      const end = pattern.indexOf("]", i); const seg = end > i ? pattern.slice(i, end + 1) : c;
      tokens.push({ text: seg, desc: "字符集合" }); i += seg.length; continue;
    }
    if (c === "(") {
      const isNonCapture = pattern.slice(i, i + 3) === "(?:";
      const isLookahead = pattern.slice(i, i + 3) === "(?=";
      const isNegLook = pattern.slice(i, i + 3) === "(?!";
      tokens.push({ text: c, desc: isNonCapture ? "非捕获组 (?:" : isLookahead ? "正向预查 (?=" : isNegLook ? "负向预查 (?!" : "捕获组" });
      i++; continue;
    }
    if (c === ")") { tokens.push({ text: c, desc: "组结束" }); i++; continue; }
    if (c === "{") {
      const end = pattern.indexOf("}", i); const seg = end > i ? pattern.slice(i, end + 1) : c;
      tokens.push({ text: seg, desc: `重复次数 ${seg}` }); i += seg.length; continue;
    }
    tokens.push({ text: c, desc: `字符 '${c}'` }); i++;
  }
  return tokens;
}

/** F07 正则速查工具 */
export default function RegexTool({ instanceId }: ToolProps) {
  const ns = `regex:${instanceId}`;
  const [pattern, setPattern] = usePersistentState(`${ns}:p`, "");
  const [flags, setFlags] = usePersistentState(`${ns}:f`, "g");
  const [testStr, setTestStr] = usePersistentState(`${ns}:s`, "");
  const [replaceStr, setReplaceStr] = usePersistentState(`${ns}:r`, "");
  const [mode, setMode] = usePersistentState<"match" | "replace">(`${ns}:m`, "match");
  const [openGroup, setOpenGroup] = useState<string | null>(GROUPS[0].title);
  const [showHighlight, setShowHighlight] = usePersistentState(`${ns}:hl`, true);
  const [snippetLang, setSnippetLang] = usePersistentState<"js"|"python"|"java">(`${ns}:sl`, "js");

  const matcher = useMemo(() => {
    if (!pattern) return null;
    try {
      const re = new RegExp(pattern, flags.replace(/[^gimsuy]/g, ""));
      return { re, error: null };
    } catch (e) {
      return { re: null, error: (e as Error).message };
    }
  }, [pattern, flags]);

  const result = useMemo(() => {
    if (!pattern) return null;
    if (matcher?.error) return { type: "error" as const, msg: matcher.error };
    const re = matcher!.re!;
    if (mode === "replace") {
      try {
        return { type: "replace" as const, text: testStr.replace(re, replaceStr) };
      } catch (e) {
        return { type: "error" as const, msg: (e as Error).message };
      }
    }
    const matches: { full: string; groups: string[]; index: number }[] = [];
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    let guard = 0;
    if (re.global) {
      while ((m = re.exec(testStr)) !== null && guard++ < 500) {
        matches.push({ full: m[0], groups: [...m].slice(1), index: m.index });
        if (m[0].length === 0) re.lastIndex++;
      }
    } else {
      m = re.exec(testStr);
      if (m) matches.push({ full: m[0], groups: [...m].slice(1), index: m.index });
    }
    return { type: "match" as const, matches };
  }, [pattern, flags, testStr, replaceStr, mode, matcher]);

  function applyPattern(p: Pattern) {
    setPattern(p.pattern);
  }

  return (
    <div className="rx-tool">
      {/* 左：速查表 */}
      <div className="rx-sheet">
        {GROUPS.map((g) => (
          <div key={g.title} className="rx-group">
            <div className="rx-group-title" onClick={() => setOpenGroup(openGroup === g.title ? null : g.title)}>
              <span>{g.title}</span>
              <span className="rx-arrow">{openGroup === g.title ? "▾" : "▸"}</span>
            </div>
            {openGroup === g.title && (
              <div className="rx-items">
                {g.items.map((item) => (
                  <div key={item.label} className="rx-item" onClick={() => applyPattern(item)} title="点击填入测试区">
                    <code className="rx-pattern">{item.pattern}</code>
                    <div className="rx-item-meta">
                      <span className="rx-item-label">{item.label}</span>
                      <span className="rx-item-desc">{item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 右：测试区 */}
      <div className="rx-tester">
        <div className="rx-row">
          <span className="rx-slash">/</span>
          <input className="rx-pinput" value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="正则表达式" spellCheck={false} />
          <span className="rx-slash">/</span>
          <div className="rx-flags-row">
            {FLAG_LIST.map(f => (
              <label key={f} className="rx-flag-cb" title={FLAG_LABELS[f]}>
                <input type="checkbox" checked={flags.includes(f)}
                  onChange={e => {
                    setFlags(prev => e.target.checked ? prev + f : prev.replace(f, ""));
                  }} />
                {f}
              </label>
            ))}
          </div>
        </div>
        <div className="rx-mode-bar">
          <label><input type="radio" name={`rx-mode-${instanceId}`} checked={mode === "match"} onChange={() => setMode("match")} /> 匹配</label>
          <label><input type="radio" name={`rx-mode-${instanceId}`} checked={mode === "replace"} onChange={() => setMode("replace")} /> 替换</label>
        </div>
        {mode === "replace" && (
          <input className="rx-replace" value={replaceStr} onChange={(e) => setReplaceStr(e.target.value)} placeholder="替换为（$1 表示第1个捕获组）" spellCheck={false} />
        )}
        <LineNumberedArea className="rx-text" value={testStr} onChange={setTestStr} placeholder="在此粘贴测试文本…" spellCheck={false} />

        {result?.type === "match" && result.matches.length > 0 && testStr && (
          <div className="rx-hl-section">
            <div className="rx-hl-bar">
              <span className="rx-hl-title">文本高亮预览</span>
              <button className="rx-hl-toggle" onClick={() => setShowHighlight(v => !v)}>
                {showHighlight ? "收起" : "展开"}
              </button>
            </div>
            {showHighlight && (
              <pre className="rx-hl-preview">
                {matcher && !matcher.error ? buildHighlightedText(testStr, matcher.re!) : testStr}
              </pre>
            )}
          </div>
        )}

        {result?.type === "error" && <div className="rx-err">错误：{result.msg}</div>}

        {result?.type === "match" && (
          <div className="rx-result">
            {result.matches.length === 0
              ? <span className="rx-no-match">无匹配</span>
              : result.matches.map((m, i) => (
                <div key={i} className="rx-match">
                  <span className="rx-match-idx">#{i + 1}</span>
                  <code className="rx-match-full">"{m.full}"</code>
                  <span className="rx-match-pos">@{m.index}</span>
                  {m.groups.map((g, gi) => g !== undefined && (
                    <span key={gi} className="rx-group-val">${gi + 1}=<code>"{g}"</code></span>
                  ))}
                </div>
              ))
            }
            <div className="rx-count">共 {result.matches.length} 个匹配</div>
          </div>
        )}

        {result?.type === "replace" && (
          <div className="rx-result">
            <div className="rx-replace-out">{result.text || "（空结果）"}</div>
            <button className="rx-copy" onClick={() => copyText(result.text)}>复制结果</button>
          </div>
        )}

        {pattern && result?.type !== "error" && (
          <div className="rx-explain">
            <div className="rx-explain-title">正则解析</div>
            <div className="rx-explain-tokens">
              {explainRegex(pattern).map((t, i) => (
                <span key={i} className="rx-tok" title={t.desc}>
                  <code>{t.text}</code>
                  <span className="rx-tok-desc">{t.desc}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {pattern && result?.type !== "error" && (
          <div className="rx-snippet">
            <div className="rx-snippet-bar">
              <span className="rx-snippet-title">代码片段</span>
              {(["js","python","java"] as const).map(l => (
                <button key={l} className={snippetLang === l ? "on" : ""} onClick={() => setSnippetLang(l)}>{l}</button>
              ))}
              <button onClick={() => copyText(buildSnippet(pattern, flags, snippetLang))}>复制</button>
            </div>
            <pre className="rx-snippet-code">{buildSnippet(pattern, flags, snippetLang)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
