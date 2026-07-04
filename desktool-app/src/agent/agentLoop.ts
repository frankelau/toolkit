import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { AgentTool, AgentLoopRequest, AgentLoopResult, ToolStep, ServiceConfig, ToolResult } from "./types";
import { toOpenAITools, toClaudeTools, findTool, executeTool } from "./toolRegistry";

/** 构建 API 请求 URL */
function apiUrl(svc: ServiceConfig): string {
  const base = svc.baseUrl.replace(/\/+$/, "");
  return svc.protocol === "openai"
    ? `${base}/v1/chat/completions`
    : `${base}/v1/messages`;
}

/** 构建 headers */
function apiHeaders(svc: ServiceConfig): Record<string, string> {
  if (svc.protocol === "openai") {
    return { "Content-Type": "application/json", Authorization: `Bearer ${svc.apiKey}` };
  }
  return {
    "Content-Type": "application/json",
    "x-api-key": svc.apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
}

/** 构建请求 body（含 tools） */
function buildRequestBody(
  svc: ServiceConfig,
  messages: { role: string; content: string | unknown[] }[],
  tools: AgentTool[],
  stream: boolean,
  systemPrompt?: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: svc.model,
    stream,
  };
  if (svc.protocol === "openai") {
    body.messages = messages;
    if (tools.length) body.tools = toOpenAITools(tools);
    if (svc.temperature != null) body.temperature = svc.temperature;
    if (svc.maxTokens) body.max_tokens = svc.maxTokens;
  } else {
    // Claude: system prompt 单独传
    if (systemPrompt) body.system = systemPrompt;
    // Claude 的 messages 不含 system
    body.messages = messages.filter(m => m.role !== "system");
    body.max_tokens = svc.maxTokens || 4096;
    if (tools.length) body.tools = toClaudeTools(tools);
    if (svc.temperature != null) body.temperature = svc.temperature;
  }
  return body;
}

/** 非流式调用（用于工具决策） */
async function callOnce(
  svc: ServiceConfig,
  messages: { role: string; content: string | unknown[] }[],
  tools: AgentTool[],
  systemPrompt?: string,
): Promise<{ text: string; toolCalls: { id: string; name: string; args: Record<string, unknown> }[] }> {
  const body = buildRequestBody(svc, messages, tools, false, systemPrompt);
  const resp = await tauriFetch(apiUrl(svc), {
    method: "POST",
    headers: apiHeaders(svc),
    body: JSON.stringify(body),
  });
  const data = await resp.json() as Record<string, unknown>;

  const toolCalls: { id: string; name: string; args: Record<string, unknown> }[] = [];

  if (svc.protocol === "openai") {
    const choice = (data.choices as Array<{ message: { content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }>)?.[0];
    const text = choice?.message?.content || "";
    if (choice?.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        try {
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments || "{}"),
          });
        } catch { /* ignore parse error */ }
      }
    }
    return { text, toolCalls };
  } else {
    // Claude
    const content = data.content as Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
    let text = "";
    if (content) {
      for (const block of content) {
        if (block.type === "text" && block.text) text += block.text;
        if (block.type === "tool_use" && block.id && block.name) {
          toolCalls.push({ id: block.id, name: block.name, args: block.input || {} });
        }
      }
    }
    return { text, toolCalls };
  }
}

/** 流式调用（最终回答） */
async function streamResponse(
  svc: ServiceConfig,
  messages: { role: string; content: string | unknown[] }[],
  tools: AgentTool[],
  onToken: (text: string) => void,
  systemPrompt?: string,
  signal?: AbortSignal,
): Promise<string> {
  const body = buildRequestBody(svc, messages, tools, true, systemPrompt);
  const resp = await fetch(apiUrl(svc), {
    method: "POST",
    headers: apiHeaders(svc),
    body: JSON.stringify(body),
    signal,
  });
  const reader = resp.body?.getReader();
  if (!reader) throw new Error("无法获取响应流");
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        if (svc.protocol === "openai") {
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) { full += delta; onToken(delta); }
        } else {
          // Claude SSE
          if (json.type === "content_block_delta" && json.delta?.text) {
            full += json.delta.text;
            onToken(json.delta.text);
          }
        }
      } catch { /* ignore parse error */ }
    }
  }
  return full;
}

/** 构建工具结果消息 */
function toolResultMessage(
  protocol: "openai" | "claude",
  toolCallId: string,
  result: string,
): { role: string; content: string | unknown[] } {
  if (protocol === "openai") {
    return { role: "tool", content: result, tool_call_id: toolCallId } as { role: string; content: string | unknown[] };
  }
  // Claude: tool_result 作为 user 消息的 content
  return {
    role: "user",
    content: [{ type: "tool_result", tool_use_id: toolCallId, content: result }],
  };
}

/** Agent 循环主函数 */
export async function runAgentLoop(req: AgentLoopRequest): Promise<AgentLoopResult> {
  const { service: svc, messages: initialMessages, tools, callbacks } = req;
  const maxRounds = req.maxRounds || 15;
  const toolSteps: ToolStep[] = [];

  // 构建消息历史（含 system prompt）
  const systemPrompt = svc.systemPrompt;
  const history: { role: string; content: string | unknown[] }[] = [];

  // 加入 system 消息（OpenAI 格式放 messages，Claude 放 body.system）
  if (svc.protocol === "openai" && systemPrompt) {
    history.push({ role: "system", content: systemPrompt });
  }
  // 加入对话历史
  for (const m of initialMessages) {
    history.push({ role: m.role, content: m.content });
  }

  let round = 0;
  let lastText = "";

  while (round < maxRounds) {
    round++;
    callbacks.onRound?.(round);

    if (tools.length === 0) {
      // 无工具：直接流式输出
      lastText = await streamResponse(svc, history, tools, callbacks.onToken, systemPrompt, req.signal);
      break;
    }

    // 有工具：先非流式调用
    const { text, toolCalls } = await callOnce(svc, history, tools, systemPrompt);

    if (toolCalls.length === 0) {
      // 无工具调用：始终流式输出最终回答
      lastText = await streamResponse(svc, history, tools, callbacks.onToken, systemPrompt, req.signal);
      break;
    }

    // 有工具调用：执行并收集结果
    // 先把 assistant 的工具调用消息加入历史
    if (svc.protocol === "openai") {
      history.push({
        role: "assistant",
        content: text || "",
        tool_calls: toolCalls.map(tc => ({
          id: tc.id, type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        })),
      } as { role: string; content: string | unknown[] });
    } else {
      // Claude
      history.push({
        role: "assistant",
        content: [
          ...(text ? [{ type: "text", text }] : []),
          ...toolCalls.map(tc => ({ type: "tool_use", id: tc.id, name: tc.name, input: tc.args })),
        ],
      });
    }

    // 执行每个工具调用
    for (const tc of toolCalls) {
      const tool = findTool(tools, tc.name);
      const source: "local" | "mcp" = tool?.source || "local";
      callbacks.onToolStart(tc.name, tc.args, source);

      const step: ToolStep = { name: tc.name, args: tc.args, source, pending: true };
      toolSteps.push(step);

      const result: ToolResult = await executeTool(tools, tc.name, tc.args);
      const resultText = result.text.slice(0, 500);
      step.result = resultText;
      step.pending = false;

      callbacks.onToolEnd(tc.name, resultText, source);
      if (result.images) callbacks.onImages?.(result.images);
      if (result.ui) callbacks.onUI?.(result.ui);

      // 加入工具结果消息
      history.push(toolResultMessage(svc.protocol, tc.id, result.text));
    }

    // 继续下一轮
  }

  if (round >= maxRounds) {
    lastText = "(达到最大工具调用轮数限制)";
  }

  return { text: lastText, toolSteps };
}
