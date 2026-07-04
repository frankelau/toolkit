/**
 * 解析 curl 命令为请求结构。
 * 支持常见 flag：-X/--request、-H/--header、-d/--data/--data-raw/--data-binary/
 * --data-urlencode、--json、-u/--user、--url、-G/--get、-b/--cookie、--compressed 等。
 * 兼容多行（行尾反斜杠续行）与单/双引号、$'...' 转义。
 */

export interface ParsedCurl {
  method: string;
  url: string;        // base URL，不含 ?query 部分
  params: { key: string; value: string }[];   // URL 中解析出的查询参数
  headers: { key: string; value: string }[];
  body: string;
}

/** 从 URL 中分离 base 与查询参数 */
export function splitUrlParams(rawUrl: string): { base: string; params: { key: string; value: string }[] } {
  try {
    const full = rawUrl.includes("://") ? rawUrl : `http://${rawUrl}`;
    const u = new URL(full);
    const params: { key: string; value: string }[] = [];
    u.searchParams.forEach((v, k) => params.push({ key: k, value: v }));
    // 重建 base（去掉 search）
    const base = rawUrl.includes("://")
      ? `${u.protocol}//${u.host}${u.pathname}`
      : `${u.host}${u.pathname}`;
    return { base, params };
  } catch {
    return { base: rawUrl, params: [] };
  }
}

/** 把 curl 命令切成 token，正确处理引号与转义 */
function tokenize(input: string): string[] {
  // 去掉行尾续行反斜杠
  const s = input.replace(/\\\r?\n/g, " ").trim();
  const tokens: string[] = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    const ch = s[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }
    let token = "";
    while (i < n && !/\s/.test(s[i])) {
      const c = s[i];
      if (c === "'") {
        // 单引号：原样直到下一个单引号
        i++;
        while (i < n && s[i] !== "'") token += s[i++];
        i++; // 跳过结束引号
      } else if (c === '"') {
        // 双引号：处理反斜杠转义
        i++;
        while (i < n && s[i] !== '"') {
          if (s[i] === "\\" && i + 1 < n) {
            const next = s[i + 1];
            if ('"\\$`'.includes(next)) {
              token += next;
              i += 2;
            } else {
              token += s[i++];
            }
          } else {
            token += s[i++];
          }
        }
        i++;
      } else if (c === "\\" && i + 1 < n) {
        // 裸反斜杠转义
        token += s[i + 1];
        i += 2;
      } else if (c === "$" && s[i + 1] === "'") {
        // $'...' ANSI-C 引用
        i += 2;
        while (i < n && s[i] !== "'") {
          if (s[i] === "\\" && i + 1 < n) {
            const next = s[i + 1];
            const map: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", "'": "'" };
            token += map[next] ?? next;
            i += 2;
          } else {
            token += s[i++];
          }
        }
        i++;
      } else {
        token += c;
        i++;
      }
    }
    tokens.push(token);
  }
  return tokens;
}

export function parseCurl(input: string): ParsedCurl {
  let raw = input.trim();
  if (!raw) throw new Error("内容为空");
  // 去掉开头的 curl
  raw = raw.replace(/^\s*curl\s+/i, "");
  const tokens = tokenize(raw);

  let method = "";
  let url = "";
  const headers: { key: string; value: string }[] = [];
  const dataParts: string[] = [];
  let urlEncodeData = false;
  let isGet = false;

  const dataFlags = new Set([
    "-d", "--data", "--data-raw", "--data-binary", "--data-ascii",
  ]);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = () => tokens[++i];

    if (t === "-X" || t === "--request") {
      method = (next() ?? "").toUpperCase();
    } else if (t === "-H" || t === "--header") {
      const h = next() ?? "";
      const idx = h.indexOf(":");
      if (idx > 0) {
        headers.push({ key: h.slice(0, idx).trim(), value: h.slice(idx + 1).trim() });
      }
    } else if (t === "--url") {
      url = next() ?? "";
    } else if (t === "-G" || t === "--get") {
      isGet = true;
    } else if (t === "-b" || t === "--cookie") {
      headers.push({ key: "Cookie", value: next() ?? "" });
    } else if (t === "-u" || t === "--user") {
      const cred = next() ?? "";
      headers.push({ key: "Authorization", value: `Basic ${btoa(cred)}` });
    } else if (t === "-A" || t === "--user-agent") {
      headers.push({ key: "User-Agent", value: next() ?? "" });
    } else if (t === "-e" || t === "--referer") {
      headers.push({ key: "Referer", value: next() ?? "" });
    } else if (t === "--json") {
      const d = next() ?? "";
      dataParts.push(d);
      if (!headers.some((h) => h.key.toLowerCase() === "content-type"))
        headers.push({ key: "Content-Type", value: "application/json" });
      if (!headers.some((h) => h.key.toLowerCase() === "accept"))
        headers.push({ key: "Accept", value: "application/json" });
    } else if (dataFlags.has(t)) {
      dataParts.push(next() ?? "");
    } else if (t === "--data-urlencode") {
      dataParts.push(next() ?? "");
      urlEncodeData = true;
    } else if (t === "--compressed" || t === "-s" || t === "--silent" ||
               t === "-L" || t === "--location" || t === "-k" ||
               t === "--insecure" || t === "-i" || t === "--include" ||
               t === "-v" || t === "--verbose" || t === "-#") {
      // 忽略不影响请求构造的开关
    } else if (t.startsWith("-")) {
      // 未知带值开关：跳过其后一个参数以免误判为 URL（保守起见仅跳过明显需要值的长选项）
      if (t.startsWith("--") && tokens[i + 1] && !tokens[i + 1].startsWith("-") &&
          !/^https?:\/\//i.test(tokens[i + 1])) {
        i++;
      }
    } else if (!url && (/^https?:\/\//i.test(t) || /^[\w.-]+\.[\w.-]+/.test(t))) {
      url = t;
    }
  }

  const body = dataParts.join(urlEncodeData ? "&" : "");

  if (!method) {
    method = body && !isGet ? "POST" : "GET";
  }

  if (!url) throw new Error("未找到 URL");

  // 从 URL 中分离查询参数
  const { base, params: urlParams } = splitUrlParams(url);

  return { method, url: base, params: urlParams, headers, body };
}
