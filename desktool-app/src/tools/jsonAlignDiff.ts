/**
 * 结构化 JSON 对齐：按 key 对齐（忽略 key 顺序），输出左右等长的行数组。
 * 某一侧缺失的行用空字符串占位（gap），从而左右逐行对齐。
 * 生成结果可直接写回两个可编辑文本框，再由 index 逐行比较做高亮。
 */

const ABSENT = Symbol("absent");
type Maybe = unknown | typeof ABSENT;

function typeOf(v: unknown): "object" | "array" | "scalar" {
  if (v !== null && typeof v === "object")
    return Array.isArray(v) ? "array" : "object";
  return "scalar";
}

function repr(v: unknown): string {
  return JSON.stringify(v);
}

function keyPrefix(key: string | null): string {
  return key !== null ? `${JSON.stringify(key)}: ` : "";
}

export interface AlignedLines {
  left: string[];
  right: string[];
}

export function alignToLines(a: unknown, b: unknown): AlignedLines {
  const left: string[] = [];
  const right: string[] = [];
  build(null, a, b, 0, "", left, right);
  return { left, right };
}

function pad(depth: number): string {
  return "  ".repeat(depth);
}

/** 左右各推一行（可为空字符串占位） */
function push(left: string[], right: string[], l: string, r: string) {
  left.push(l);
  right.push(r);
}

/** 把单侧子树整体渲染成行，另一侧全部用空行占位 */
function renderWhole(
  key: string | null,
  value: unknown,
  depth: number,
  trail: string,
  side: "left" | "right",
  left: string[],
  right: string[],
) {
  const tmp: string[] = [];
  renderLines(key, value, depth, trail, tmp);
  for (const line of tmp) {
    if (side === "left") push(left, right, line, "");
    else push(left, right, "", line);
  }
}

/** 把一个值渲染为多行 JSON 文本（带缩进/尾逗号交给调用方略过） */
function renderLines(
  key: string | null,
  value: unknown,
  depth: number,
  trail: string,
  out: string[],
) {
  const p = pad(depth);
  const t = typeOf(value);
  if (t === "scalar") {
    out.push(`${p}${keyPrefix(key)}${repr(value)}${trail}`);
    return;
  }
  if (t === "array") {
    const arr = value as unknown[];
    out.push(`${p}${keyPrefix(key)}[`);
    arr.forEach((v, i) =>
      renderLines(null, v, depth + 1, i < arr.length - 1 ? "," : "", out),
    );
    out.push(`${p}]${trail}`);
    return;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  out.push(`${p}${keyPrefix(key)}{`);
  keys.forEach((k, i) =>
    renderLines(k, obj[k], depth + 1, i < keys.length - 1 ? "," : "", out),
  );
  out.push(`${p}}${trail}`);
}

function build(
  key: string | null,
  a: Maybe,
  b: Maybe,
  depth: number,
  trail: string,
  left: string[],
  right: string[],
) {
  const aAbsent = a === ABSENT;
  const bAbsent = b === ABSENT;

  if (aAbsent || bAbsent) {
    const present = aAbsent ? b : a;
    renderWhole(key, present, depth, trail, aAbsent ? "right" : "left", left, right);
    return;
  }

  const ta = typeOf(a);
  const tb = typeOf(b);
  const p = pad(depth);

  // 类型不同 / 标量不同 → 同位置左右各显示自身（一行）
  if (ta !== tb || ta === "scalar") {
    push(
      left,
      right,
      `${p}${keyPrefix(key)}${repr(a)}${trail}`,
      `${p}${keyPrefix(key)}${repr(b)}${trail}`,
    );
    return;
  }

  if (ta === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    push(left, right, `${p}${keyPrefix(key)}{`, `${p}${keyPrefix(key)}{`);
    const keys = Array.from(
      new Set([...Object.keys(ao), ...Object.keys(bo)]),
    ).sort();
    keys.forEach((k, i) => {
      const t = i < keys.length - 1 ? "," : "";
      const av = k in ao ? ao[k] : ABSENT;
      const bv = k in bo ? bo[k] : ABSENT;
      build(k, av, bv, depth + 1, t, left, right);
    });
    push(left, right, `${p}}${trail}`, `${p}}${trail}`);
    return;
  }

  // array：按下标对齐
  const aa = a as unknown[];
  const ba = b as unknown[];
  push(left, right, `${p}${keyPrefix(key)}[`, `${p}${keyPrefix(key)}[`);
  const max = Math.max(aa.length, ba.length);
  for (let i = 0; i < max; i++) {
    const t = i < max - 1 ? "," : "";
    const av = i < aa.length ? aa[i] : ABSENT;
    const bv = i < ba.length ? ba[i] : ABSENT;
    build(null, av, bv, depth + 1, t, left, right);
  }
  push(left, right, `${p}]${trail}`, `${p}]${trail}`);
}
