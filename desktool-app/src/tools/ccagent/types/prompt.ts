// prompt.ts — Prompt 模板类型

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  modified?: number;
}
