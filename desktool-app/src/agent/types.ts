/** Agent 共享类型定义 */

/** 工具来源 */
export type ToolSource = "local" | "mcp";

/** 工具执行结果 */
export interface ToolResult {
  /** 返回给 LLM 的文本 */
  text: string;
  /** 可选 HTML（生成式 UI） */
  ui?: string;
  /** 可选图片列表 */
  images?: { url: string; alt: string }[];
}

/** 统一工具定义 */
export interface AgentTool {
  /** 唯一标识 */
  id: string;
  /** LLM function name（必须唯一，只含字母数字下划线） */
  name: string;
  /** LLM function description */
  description: string;
  /** JSON Schema 参数定义 */
  inputSchema: object;
  /** 来源 */
  source: ToolSource;
  /** 执行函数 */
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
}

/** 工具调用步骤（UI 展示用） */
export interface ToolStep {
  name: string;
  args: unknown;
  result?: string;
  source: ToolSource;
  /** 是否正在执行 */
  pending?: boolean;
}

/** 聊天消息 */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  images?: { url: string; alt: string }[];
  toolSteps?: ToolStep[];
}

/** LLM 服务配置 */
export interface ServiceConfig {
  id: string;
  name: string;
  protocol: "openai" | "claude";
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

/** 子代理定义 */
export interface SubagentDef {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[];
  model?: string;
}

/** Agent 循环回调 */
export interface AgentCallbacks {
  /** 流式 token 回调 */
  onToken: (text: string) => void;
  /** 工具开始执行 */
  onToolStart: (name: string, args: unknown, source: ToolSource) => void;
  /** 工具执行完成 */
  onToolEnd: (name: string, result: string, source: ToolSource) => void;
  /** 生成式 UI 回调 */
  onUI?: (html: string) => void;
  /** 图片结果回调 */
  onImages?: (images: { url: string; alt: string }[]) => void;
  /** 当前轮次回调 */
  onRound?: (round: number) => void;
}

/** Agent 循环请求 */
export interface AgentLoopRequest {
  service: ServiceConfig;
  messages: { role: "user" | "assistant"; content: string }[];
  tools: AgentTool[];
  callbacks: AgentCallbacks;
  maxRounds?: number;
  signal?: AbortSignal;
}

/** Agent 循环结果 */
export interface AgentLoopResult {
  text: string;
  toolSteps: ToolStep[];
}
