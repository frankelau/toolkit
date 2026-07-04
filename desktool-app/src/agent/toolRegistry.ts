import type { AgentTool, ToolResult } from "./types";
import { LOCAL_TOOLS } from "./localTools";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

/** MCP 服务器配置 */
export interface McpServerConfig {
  id: string;
  name: string;
  url: string;
  headers?: Record<string, string>;
  enabled: boolean;
}

/** MCP 工具信息（从 tools/list 获取） */
interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: object;
}

/** 从 MCP 服务器拉取工具列表 */
async function fetchMcpTools(server: McpServerConfig): Promise<AgentTool[]> {
  try {
    const resp = await tauriFetch(server.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...server.headers },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    const data = await resp.json() as { result?: { tools?: McpToolInfo[] } };
    const tools = data.result?.tools || [];
    return tools.map(t => ({
      id: `mcp:${server.id}:${t.name}`,
      name: t.name,
      description: t.description || "",
      inputSchema: t.inputSchema || { type: "object", properties: {} },
      source: "local" as const, // 统一用 local 标记，但通过 execute 调用 MCP
      execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
        const callResp = await tauriFetch(server.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...server.headers },
          body: JSON.stringify({
            jsonrpc: "2.0", id: 1, method: "tools/call",
            params: { name: t.name, arguments: args },
          }),
        });
        const callData = await callResp.json() as { result?: { content?: Array<{ type: string; text?: string }> } };
        const text = callData.result?.content?.[0]?.text || JSON.stringify(callData.result || {});
        return { text };
      },
    }));
  } catch {
    return [];
  }
}

/** 从所有 MCP 服务器加载工具 */
export async function loadMcpTools(servers: McpServerConfig[]): Promise<AgentTool[]> {
  const enabled = servers.filter(s => s.enabled && s.url);
  const results = await Promise.all(enabled.map(s => fetchMcpTools(s)));
  return results.flat();
}

/** 获取所有可用工具（本地 + MCP） */
export function getAllTools(mcpTools: AgentTool[]): AgentTool[] {
  const map = new Map<string, AgentTool>();
  // 先放本地工具
  for (const t of LOCAL_TOOLS) map.set(t.name, t);
  // 再放 MCP 工具（如果重名则 MCP 覆盖本地）
  for (const t of mcpTools) map.set(t.name, t);
  return Array.from(map.values());
}

/** 按名称查找工具 */
export function findTool(tools: AgentTool[], name: string): AgentTool | undefined {
  return tools.find(t => t.name === name);
}

/** 执行工具 */
export async function executeTool(tools: AgentTool[], name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const tool = findTool(tools, name);
  if (!tool) return { text: `工具 ${name} 不存在` };
  try {
    return await tool.execute(args);
  } catch (e) {
    return { text: `工具执行失败：${e instanceof Error ? e.message : String(e)}` };
  }
}

/** 将工具列表转为 OpenAI function calling 格式 */
export function toOpenAITools(tools: AgentTool[]) {
  return tools.map(t => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

/** 将工具列表转为 Claude tool 格式 */
export function toClaudeTools(tools: AgentTool[]) {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}
