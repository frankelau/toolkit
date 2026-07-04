/**
 * 引擎无关的 JSON 错误定位器。
 * 浏览器/Node 的 JSON.parse 报错信息格式不一（V8 有 "position N"，
 * JavaScriptCore/WKWebView 没有），所以自己扫描定位首个语法错误的行列。
 */

export interface JsonError {
  /** 1-based 行号 */
  line: number;
  /** 1-based 列号 */
  col: number;
  /** 错误说明 */
  message: string;
  /** 0-based 字符偏移 */
  pos: number;
}

/** 校验 JSON 文本，返回首个错误的位置；合法返回 null。 */
export function locateJsonError(text: string): JsonError | null {
  const p = new Scanner(text);
  try {
    p.skipWs();
    if (p.pos >= text.length) return p.err("空内容");
    p.parseValue();
    p.skipWs();
    if (p.pos < text.length) return p.err(`多余内容：'${text[p.pos]}'`);
    return null;
  } catch (e) {
    if (e instanceof ScanError) {
      return locAt(text, e.pos, e.message);
    }
    // 兜底：未知异常
    return locAt(text, 0, (e as Error).message);
  }
}

function locAt(text: string, pos: number, message: string): JsonError {
  const clamped = Math.min(Math.max(pos, 0), text.length);
  const before = text.slice(0, clamped);
  const line = before.split("\n").length;
  const col = clamped - before.lastIndexOf("\n");
  return { line, col, message, pos: clamped };
}

class ScanError extends Error {
  pos: number;
  constructor(message: string, pos: number) {
    super(message);
    this.pos = pos;
  }
}

class Scanner {
  pos = 0;
  constructor(public text: string) {}

  err(msg: string): JsonError {
    return locAt(this.text, this.pos, msg);
  }

  fail(msg: string): never {
    throw new ScanError(msg, this.pos);
  }

  skipWs() {
    while (this.pos < this.text.length) {
      const c = this.text[this.pos];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") this.pos++;
      else break;
    }
  }

  parseValue() {
    this.skipWs();
    if (this.pos >= this.text.length) this.fail("提前结束，期望一个值");
    const c = this.text[this.pos];
    if (c === "{") return this.parseObject();
    if (c === "[") return this.parseArray();
    if (c === '"') return this.parseString();
    if (c === "-" || (c >= "0" && c <= "9")) return this.parseNumber();
    if (this.text.startsWith("true", this.pos)) { this.pos += 4; return; }
    if (this.text.startsWith("false", this.pos)) { this.pos += 5; return; }
    if (this.text.startsWith("null", this.pos)) { this.pos += 4; return; }
    this.fail(`意外的字符 '${c}'，期望一个值`);
  }
  parseObject() {
    this.pos++; // {
    this.skipWs();
    if (this.text[this.pos] === "}") { this.pos++; return; }
    for (;;) {
      this.skipWs();
      if (this.text[this.pos] !== '"') this.fail('期望属性名（双引号字符串）');
      this.parseString();
      this.skipWs();
      if (this.text[this.pos] !== ":") this.fail("期望 ':'");
      this.pos++;
      this.parseValue();
      this.skipWs();
      const c = this.text[this.pos];
      if (c === ",") { this.pos++; continue; }
      if (c === "}") { this.pos++; return; }
      this.fail("期望 ',' 或 '}'");
    }
  }

  parseArray() {
    this.pos++; // [
    this.skipWs();
    if (this.text[this.pos] === "]") { this.pos++; return; }
    for (;;) {
      this.parseValue();
      this.skipWs();
      const c = this.text[this.pos];
      if (c === ",") { this.pos++; continue; }
      if (c === "]") { this.pos++; return; }
      this.fail("期望 ',' 或 ']'");
    }
  }

  parseString() {
    this.pos++; // opening "
    for (;;) {
      if (this.pos >= this.text.length) this.fail("字符串未闭合");
      const c = this.text[this.pos];
      if (c === '"') { this.pos++; return; }
      if (c === "\\") {
        this.pos++;
        if (this.pos >= this.text.length) this.fail("转义未完成");
        this.pos++;
        continue;
      }
      if (c === "\n") this.fail("字符串内不能有换行");
      this.pos++;
    }
  }

  parseNumber() {
    const start = this.pos;
    if (this.text[this.pos] === "-") this.pos++;
    while (this.pos < this.text.length && /[0-9]/.test(this.text[this.pos])) this.pos++;
    if (this.text[this.pos] === ".") {
      this.pos++;
      while (this.pos < this.text.length && /[0-9]/.test(this.text[this.pos])) this.pos++;
    }
    if (this.text[this.pos] === "e" || this.text[this.pos] === "E") {
      this.pos++;
      if (this.text[this.pos] === "+" || this.text[this.pos] === "-") this.pos++;
      while (this.pos < this.text.length && /[0-9]/.test(this.text[this.pos])) this.pos++;
    }
    if (this.pos === start) this.fail("无效数字");
  }
}

