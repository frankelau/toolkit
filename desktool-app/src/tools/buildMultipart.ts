/**
 * 纯函数：把 FormField[] 编码为 multipart/form-data 的 Uint8Array。
 * tauriFetch 接受 Uint8Array 作为 body，无需引入额外依赖。
 */

export interface FormField {
  key: string;
  valueType: "text" | "file";
  value: string;        // text 字段的值
  fileName?: string;    // file 字段的文件名
  fileData?: Uint8Array;// file 字段的二进制内容
  mimeType?: string;    // file 字段的 MIME 类型
}

const enc = new TextEncoder();

function line(s: string): Uint8Array {
  return enc.encode(s + "\r\n");
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function buildMultipart(fields: FormField[]): { body: Uint8Array; boundary: string } {
  // 生成随机 boundary
  const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}${Date.now()}`;
  const parts: Uint8Array[] = [];

  for (const f of fields) {
    if (!f.key.trim()) continue;
    parts.push(line(`--${boundary}`));

    if (f.valueType === "file" && f.fileData) {
      const mime = f.mimeType ?? "application/octet-stream";
      const fname = f.fileName ?? "file";
      parts.push(line(`Content-Disposition: form-data; name="${f.key}"; filename="${fname}"`));
      parts.push(line(`Content-Type: ${mime}`));
      parts.push(line(""));           // 空行分隔头与体
      parts.push(f.fileData);
      parts.push(enc.encode("\r\n"));
    } else {
      parts.push(line(`Content-Disposition: form-data; name="${f.key}"`));
      parts.push(line(""));
      parts.push(line(f.value));
    }
  }

  parts.push(enc.encode(`--${boundary}--\r\n`));
  return { body: concat(parts), boundary };
}

/** 把 form-data 字段序列化为 application/x-www-form-urlencoded 字符串 */
export function buildUrlEncoded(fields: FormField[]): string {
  const params = new URLSearchParams();
  for (const f of fields) {
    if (f.key.trim() && f.valueType === "text") {
      params.set(f.key.trim(), f.value);
    }
  }
  return params.toString();
}
