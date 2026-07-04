// utils/exportMarkdown.test.ts — 导出格式测试
// D6: 覆盖 D4 新增的导出函数

import { describe, it, expect } from "vitest";
import {
  exportMessagesToMarkdown, exportMessagesToText, exportMessagesToJson,
} from "./exportMarkdown";
import type { ChatMessage } from "../types";

function makeMsg(partial: Partial<ChatMessage>): ChatMessage {
  return {
    id: "test",
    role: "user",
    content: "",
    timestamp: 1000000,
    ...partial,
  };
}

const sampleMessages: ChatMessage[] = [
  makeMsg({ id: "u1", role: "user", content: "Hello", timestamp: 1000 }),
  makeMsg({
    id: "a1", role: "assistant", content: "Hi there",
    timestamp: 2000,
    thinking: "Let me think...",
    toolUses: [
      { id: "t1", name: "Bash", input: { command: "ls" }, result: "file1\nfile2" },
    ],
    usage: { inputTokens: 100, outputTokens: 50, costUsd: 0.01, cacheReadTokens: 50, cacheCreateTokens: 20 },
  }),
  makeMsg({ id: "u2", role: "user", content: "Thanks", timestamp: 3000 }),
];

describe("exportMessagesToMarkdown", () => {
  it("生成 markdown 格式带标题", () => {
    const md = exportMessagesToMarkdown(sampleMessages);
    expect(md).toContain("# 对话导出");
    expect(md).toContain("Hello");
    expect(md).toContain("Hi there");
  });

  it("包含消息数统计", () => {
    const md = exportMessagesToMarkdown(sampleMessages);
    expect(md).toContain("消息数: 3");
  });

  it("包含 thinking 折叠区", () => {
    const md = exportMessagesToMarkdown(sampleMessages);
    expect(md).toContain("思考过程");
    expect(md).toContain("Let me think");
  });

  it("空消息列表", () => {
    const md = exportMessagesToMarkdown([]);
    expect(md).toContain("消息数: 0");
  });
});

describe("exportMessagesToText", () => {
  it("生成纯文本格式", () => {
    const text = exportMessagesToText(sampleMessages);
    expect(text).toContain("[User] Hello");
    expect(text).toContain("[Assistant]");
  });

  it("空消息列表返回空字符串", () => {
    expect(exportMessagesToText([])).toBe("");
  });
});

describe("exportMessagesToJson", () => {
  it("生成有效 JSON 数组", () => {
    const json = exportMessagesToJson(sampleMessages);
    const parsed: Array<Record<string, unknown>> = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(3);
  });

  it("包含消息角色和内容", () => {
    const json = exportMessagesToJson(sampleMessages);
    const parsed: Array<Record<string, unknown>> = JSON.parse(json);
    expect(parsed[0].role).toBe("user");
    expect(parsed[0].content).toBe("Hello");
  });

  it("包含 thinking", () => {
    const json = exportMessagesToJson(sampleMessages);
    const parsed: Array<Record<string, unknown>> = JSON.parse(json);
    expect(parsed[1].thinking).toBe("Let me think...");
  });

  it("空消息列表", () => {
    const json = exportMessagesToJson([]);
    const parsed: Array<Record<string, unknown>> = JSON.parse(json);
    expect(parsed).toEqual([]);
  });
});
