// agent.ts — Agent 配置类型

export interface AgentConfig {
  id: string;
  /** Agent 名称（最长 20 字符） */
  name: string;
  /** Prompt（最长 100000 字符） */
  prompt?: string;
  /** 创建时间戳 */
  createdAt?: number;
}

/** 上下文栏选中的文件/代码（对应 cc-gui 的 ContextBar） */
export interface SelectedContext {
  type: "file" | "code";
  filePath: string;
  /** 代码片段（type=code 时） */
  code?: string;
  /** 起始行 */
  startLine?: number;
  /** 结束行 */
  endLine?: number;
}
