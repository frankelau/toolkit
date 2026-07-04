/**
 * 把 Python 风格的字面量（dict/list 打印结果）修正为合法 JSON。
 * 关键点：只在“字符串外”做替换，避免误伤字符串内容里的 None/True 等。
 * 处理：单引号 → 双引号、None→null、True→true、False→false、
 * (元组)→[数组]、尾随逗号清理。
 */
export function pythonToJson(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;

  // 逐字符扫描，遇到字符串整体透传（并把 Python 单引号串转成双引号串）
  while (i < n) {
    const ch = src[i];

    // 字符串：单引号或双引号
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let str = "";
      i++; // 跳过开引号
      while (i < n) {
        const c = src[i];
        if (c === "\\") {
          // 保留转义对
          str += c + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        if (c === quote) {
          i++; // 跳过闭引号
          break;
        }
        str += c;
        i++;
      }
      // 统一输出为双引号字符串：转义内部双引号，把 \' 还原为 '
      const normalized = str
        .replace(/\\'/g, "'")
        .replace(/"/g, '\\"');
      out += `"${normalized}"`;
      continue;
    }

    // 字符串外：识别裸标识符 None/True/False，元组括号
    if (/[A-Za-z_]/.test(ch)) {
      let word = "";
      while (i < n && /[A-Za-z0-9_]/.test(src[i])) {
        word += src[i];
        i++;
      }
      if (word === "None") out += "null";
      else if (word === "True") out += "true";
      else if (word === "False") out += "false";
      else out += word; // 其他标识符原样（可能是非法，交给后续 JSON.parse 报错）
      continue;
    }

    // Python 元组 () → JSON 数组 []（仅在结构位置粗略处理）
    if (ch === "(") {
      out += "[";
      i++;
      continue;
    }
    if (ch === ")") {
      out += "]";
      i++;
      continue;
    }

    out += ch;
    i++;
  }

  // 清理尾随逗号： ,] 或 ,}
  out = out.replace(/,(\s*[}\]])/g, "$1");
  return out;
}
