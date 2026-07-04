// utils/markdown.test.ts — markdown 渲染函数测试
// D6: 覆盖 D1 新增的流式安全、系统标签清理等函数

import { describe, it, expect, vi } from "vitest";

// DOMPurify 在 node 环境下不可用，mock 掉 sanitize
vi.mock("dompurify", () => ({
  default: {
    sanitize: (html: string) => html,
    addHook: () => {},
  },
}));
import {
  stripSystemTags, makeStreamSafe, renderStreamingContent,
  hasPossibleMermaidContent, isMermaidKeyword,
} from "./markdown";

describe("stripSystemTags", () => {
  it("移除 commit_analysis 标签", () => {
    const input = "Hello\n<commit_analysis>data</commit_analysis>\nWorld";
    const result = stripSystemTags(input);
    expect(result).not.toContain("commit_analysis");
  });

  it("移除 context 标签", () => {
    const input = "Hi\n<context>secret info</context>\nBye";
    const result = stripSystemTags(input);
    expect(result).not.toContain("context");
  });

  it("移除 function_analysis 标签", () => {
    const input = "Q\n<function_analysis>analysis</function_analysis>\nA";
    const result = stripSystemTags(input);
    expect(result).not.toContain("analysis");
  });

  it("不包含系统标签时原样返回", () => {
    const input = "Just some text with <code>html</code>";
    expect(stripSystemTags(input)).toBe(input);
  });
});

describe("makeStreamSafe", () => {
  it("闭合不完整的代码块", () => {
    const input = "```python\nprint('hello')\n";
    const result = makeStreamSafe(input);
    expect(result).toContain("```");
  });

  it("已闭合的代码块不变", () => {
    const input = "```python\nprint('hello')\n```\n";
    expect(makeStreamSafe(input)).toBe(input);
  });

  it("无代码块不变", () => {
    const input = "Hello world";
    expect(makeStreamSafe(input)).toBe(input);
  });

  it("配对奇数个反引号时补全", () => {
    const input = "```js\nconst x = 1";
    expect(makeStreamSafe(input)).toContain("```");
  });
});

describe("renderStreamingContent", () => {
  it("渲染纯文本", () => {
    const result = renderStreamingContent("Hello World");
    expect(result).toContain("Hello");
  });

  it("返回非空 HTML", () => {
    const result = renderStreamingContent("test");
    expect(result.length).toBeGreaterThan(0);
  });

  it("代码块使用 pre/code 包装", () => {
    const result = renderStreamingContent("```python\nprint(1)\n```");
    expect(result).toContain("<pre>");
    expect(result).toContain("class=\"language-python\"");
  });

  it("处理空输入", () => {
    expect(renderStreamingContent("")).toBe("");
  });
});

describe("hasPossibleMermaidContent", () => {
  it("检测 flowchart", () => {
    expect(hasPossibleMermaidContent("```mermaid\nflowchart TD\nA-->B\n```")).toBe(true);
  });

  it("检测 sequenceDiagram", () => {
    expect(hasPossibleMermaidContent("```mermaid\nsequenceDiagram\nA->>B\n```")).toBe(true);
  });

  it("非 mermaid 代码块返回 false", () => {
    expect(hasPossibleMermaidContent("```python\nprint(1)\n```")).toBe(false);
  });

  it("检测 graph", () => {
    expect(hasPossibleMermaidContent("```mermaid\ngraph LR\nA-->B\n```")).toBe(true);
  });
});

describe("isMermaidKeyword", () => {
  it("flowchart 是 keyword", () => {
    expect(isMermaidKeyword("flowchart")).toBe(true);
  });

  it("sequenceDiagram 是 keyword", () => {
    expect(isMermaidKeyword("sequenceDiagram")).toBe(true);
  });

  it("graph 是 keyword", () => {
    expect(isMermaidKeyword("graph")).toBe(true);
  });

  it("classDiagram 是 keyword", () => {
    expect(isMermaidKeyword("classDiagram")).toBe(true);
  });

  it("普通词不是 keyword", () => {
    expect(isMermaidKeyword("hello")).toBe(false);
  });

  it("erDiagram 是 keyword", () => {
    expect(isMermaidKeyword("erDiagram")).toBe(true);
  });
});
