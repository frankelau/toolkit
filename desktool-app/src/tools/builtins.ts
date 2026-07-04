/** Postman 内置函数定义与解析 */

export interface BuiltinFn {
  name: string;       // 不含 $，如 "timestamp"
  syntax: string;     // 完整写法，如 "{{$timestamp}}"
  desc: string;
  example: string;
}

export const BUILTIN_FNS: BuiltinFn[] = [
  {
    name: "timestamp",
    syntax: "{{$timestamp}}",
    desc: "当前 Unix 时间戳（秒）",
    example: "1719100000",
  },
  {
    name: "timestampMs",
    syntax: "{{$timestampMs}}",
    desc: "当前 Unix 时间戳（毫秒）",
    example: "1719100000000",
  },
  {
    name: "isoTimestamp",
    syntax: "{{$isoTimestamp}}",
    desc: "当前时间 ISO 8601 格式",
    example: "2026-06-23T12:00:00.000Z",
  },
  {
    name: "uuid",
    syntax: "{{$uuid}}",
    desc: "随机 UUID v4",
    example: "550e8400-e29b-41d4-a716-446655440000",
  },
  {
    name: "guid",
    syntax: "{{$guid}}",
    desc: "随机 GUID（同 uuid）",
    example: "550e8400-e29b-41d4-a716-446655440000",
  },
  {
    name: "randomInt",
    syntax: "{{$randomInt}}",
    desc: "随机整数 0–1000",
    example: "42",
  },
  {
    name: "randomFloat",
    syntax: "{{$randomFloat}}",
    desc: "随机浮点数 0–1",
    example: "0.7312",
  },
  {
    name: "randomHex",
    syntax: "{{$randomHex}}",
    desc: "8 位随机十六进制",
    example: "a3f2c1b0",
  },
  {
    name: "date",
    syntax: "{{$date}}",
    desc: "今天日期 YYYY-MM-DD",
    example: "2026-06-23",
  },
];

function uuidV4(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  arr[6] = (arr[6] & 0x0f) | 0x40;
  arr[8] = (arr[8] & 0x3f) | 0x80;
  const h = (b: number) => b.toString(16).padStart(2, "0");
  return [
    ...[0, 1, 2, 3].map((i) => h(arr[i])),
    "-",
    ...[4, 5].map((i) => h(arr[i])),
    "-",
    ...[6, 7].map((i) => h(arr[i])),
    "-",
    ...[8, 9].map((i) => h(arr[i])),
    "-",
    ...[10, 11, 12, 13, 14, 15].map((i) => h(arr[i])),
  ].join("");
}

/** 解析字符串中的所有 {{$fn}} 占位符，每次调用时重新求值 */
export function resolveBuiltins(input: string): string {
  const now = new Date();
  return input.replace(/\{\{\$([a-zA-Z]+)\}\}/g, (_match, name: string) => {
    switch (name) {
      case "timestamp":    return String(Math.floor(Date.now() / 1000));
      case "timestampMs":  return String(Date.now());
      case "isoTimestamp": return now.toISOString();
      case "uuid":
      case "guid":         return uuidV4();
      case "randomInt":    return String(Math.floor(Math.random() * 1001));
      case "randomFloat":  return (Math.random()).toFixed(4);
      case "randomHex":    return Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
      case "date":         return now.toISOString().slice(0, 10);
      default:             return _match; // 未知的保持原样
    }
  });
}
