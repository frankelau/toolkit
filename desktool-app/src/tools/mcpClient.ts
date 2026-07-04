import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { addEntry, updateEntry } from "./networkLog";

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface McpSession {
  endpoint: string;
  sessionId?: string;
  protocolVersion: string;
}

let rpcId = 0;

/** 从可能是 SSE 的响应体中解析出 JSON-RPC 消息 */
function parseBody(contentType: string, text: string): JsonRpcResponse | null {
  if (contentType.includes("text/event-stream")) {
    // SSE：逐行取 data:，返回最后一条带 result/error 的消息
    let last: JsonRpcResponse | null = null;
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (t.startsWith("data:")) {
        const payload = t.slice(5).trim();
        if (!payload) continue;
        try {
          const msg = JSON.parse(payload) as JsonRpcResponse;
          if (msg.result !== undefined || msg.error !== undefined) last = msg;
        } catch {
          /* 忽略非 JSON 行 */
        }
      }
    }
    return last;
  }
  try {
    return JSON.parse(text) as JsonRpcResponse;
  } catch {
    return null;
  }
}

/** 发送一条 JSON-RPC 请求 */
async function rpc(
  session: McpSession,
  method: string,
  params?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<JsonRpcResponse> {
  const id = ++rpcId;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...extraHeaders,
  };
  if (session.sessionId) headers["Mcp-Session-Id"] = session.sessionId;
  if (session.protocolVersion)
    headers["MCP-Protocol-Version"] = session.protocolVersion;

  const reqBody = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  const t0 = performance.now();
  const logId = addEntry({
    tool: "mcp", type: "http", method: `RPC ${method}`, url: session.endpoint,
    reqHeaders: headers, reqBody, state: "pending",
  });

  try {
    const r = await tauriFetch(session.endpoint, {
      method: "POST",
      headers,
      body: reqBody,
    });

    // 服务端可能在初始化响应里下发 session id
    const sid = r.headers.get("mcp-session-id");
    if (sid) session.sessionId = sid;

    const ct = r.headers.get("content-type") ?? "";
    const text = await r.text();
    const respHeaders: [string, string][] = [];
    r.headers.forEach((v, k) => respHeaders.push([k, v]));
    updateEntry(logId, {
      status: r.status, statusText: r.statusText, resHeaders: respHeaders,
      resBody: text, duration: Math.round(performance.now() - t0),
      state: r.ok ? "done" : "error",
    });
    if (!r.ok) {
      throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
    }
    const msg = parseBody(ct, text);
    if (!msg) throw new Error(`无法解析响应：${text.slice(0, 200)}`);
    if (msg.error) throw new Error(`${msg.error.message} (code ${msg.error.code})`);
    return msg;
  } catch (e) {
    updateEntry(logId, {
      error: (e as Error).message, duration: Math.round(performance.now() - t0), state: "error",
    });
    throw e;
  }
}

/** 发送通知（无需响应），用于 notifications/initialized */
async function notify(session: McpSession, method: string, extraHeaders?: Record<string, string>): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...extraHeaders,
  };
  if (session.sessionId) headers["Mcp-Session-Id"] = session.sessionId;
  if (session.protocolVersion)
    headers["MCP-Protocol-Version"] = session.protocolVersion;
  await tauriFetch(session.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", method }),
  });
}

const PROTOCOL_VERSION = "2025-06-18";

export interface InitResult {
  session: McpSession;
  serverInfo: { name?: string; version?: string };
  capabilities: Record<string, unknown>;
}

/** initialize 握手 + initialized 通知 */
export async function mcpInitialize(endpoint: string, headers?: Record<string, string>): Promise<InitResult> {
  const session: McpSession = { endpoint, protocolVersion: PROTOCOL_VERSION };
  const res = await rpc(session, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "Toolkit MCP 测试", version: "0.1.0" },
  }, headers);
  const result = res.result as {
    serverInfo?: { name?: string; version?: string };
    capabilities?: Record<string, unknown>;
    protocolVersion?: string;
  };
  if (result.protocolVersion) session.protocolVersion = result.protocolVersion;
  // 完成握手
  try {
    await notify(session, "notifications/initialized", headers);
  } catch {
    /* 部分服务端不要求，忽略 */
  }
  return {
    session,
    serverInfo: result.serverInfo ?? {},
    capabilities: result.capabilities ?? {},
  };
}

export async function mcpList(
  session: McpSession,
  what: "tools" | "resources" | "prompts",
  headers?: Record<string, string>,
): Promise<unknown[]> {
  const res = await rpc(session, `${what}/list`, {}, headers);
  const result = res.result as Record<string, unknown[]>;
  return result[what] ?? [];
}

export async function mcpCallTool(
  session: McpSession,
  name: string,
  args: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<unknown> {
  const res = await rpc(session, "tools/call", { name, arguments: args }, headers);
  return res.result;
}

export async function mcpReadResource(
  session: McpSession,
  uri: string,
  headers?: Record<string, string>,
): Promise<unknown> {
  const res = await rpc(session, "resources/read", { uri }, headers);
  return res.result;
}
