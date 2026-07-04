// utils/messageUtils.test.ts — 消息工具函数测试
// Sprint M: 对齐 cc-gui 的测试结构

import { describe, it, expect } from "vitest";
import {
  extractToolUses, countUserMessages, countAssistantMessages,
  countToolUses, countToolErrors,
  getLastUserMessage, getLastAssistantMessage,
  sumUsage, searchMessages, summarizeMessage, getMessageKey,
  countToolsByType, computeTurnStats, computeSessionSummary,
} from "./messageUtils";
import type { ChatMessage } from "../types";

function makeMsg(partial: Partial<ChatMessage>): ChatMessage {
  return {
    id: "test-id",
    role: "user",
    content: "",
    timestamp: Date.now(),
    ...partial,
  };
}

const sampleMessages: ChatMessage[] = [
  makeMsg({ id: "u1", role: "user", content: "Hello" }),
  makeMsg({
    id: "a1", role: "assistant", content: "Hi",
    toolUses: [{ id: "t1", name: "Bash", input: { command: "ls" } }],
    usage: { inputTokens: 100, outputTokens: 50, costUsd: 0.01 },
  }),
  makeMsg({ id: "u2", role: "user", content: "Run tests" }),
  makeMsg({
    id: "a2", role: "assistant", content: "Failed",
    toolUses: [
      { id: "t2", name: "Bash", input: {}, isError: true },
      { id: "t3", name: "Read", input: {} },
    ],
    usage: { inputTokens: 200, outputTokens: 80, costUsd: 0.02 },
  }),
];

describe("messageUtils", () => {
  describe("extractToolUses", () => {
    it("从消息列表提取所有工具调用", () => {
      const tools = extractToolUses(sampleMessages);
      expect(tools.length).toBe(3);
      expect(tools[0].tool.name).toBe("Bash");
    });
  });

  describe("countUserMessages / countAssistantMessages", () => {
    it("统计用户消息数", () => {
      expect(countUserMessages(sampleMessages)).toBe(2);
    });
    it("统计 assistant 消息数", () => {
      expect(countAssistantMessages(sampleMessages)).toBe(2);
    });
    it("空数组", () => {
      expect(countUserMessages([])).toBe(0);
      expect(countAssistantMessages([])).toBe(0);
    });
  });

  describe("countToolUses / countToolErrors", () => {
    it("统计工具调用总数", () => {
      expect(countToolUses(sampleMessages)).toBe(3);
    });
    it("统计错误工具调用数", () => {
      expect(countToolErrors(sampleMessages)).toBe(1);
    });
  });

  describe("getLastUserMessage / getLastAssistantMessage", () => {
    it("获取最后一条用户消息", () => {
      const last = getLastUserMessage(sampleMessages);
      expect(last?.id).toBe("u2");
      expect(last?.content).toBe("Run tests");
    });
    it("获取最后一条 assistant 消息", () => {
      const last = getLastAssistantMessage(sampleMessages);
      expect(last?.id).toBe("a2");
    });
    it("无匹配返回 undefined", () => {
      expect(getLastUserMessage([])).toBeUndefined();
    });
  });

  describe("sumUsage", () => {
    it("累计 token 与费用", () => {
      const usage = sumUsage(sampleMessages);
      expect(usage.inputTokens).toBe(300);
      expect(usage.outputTokens).toBe(130);
      expect(usage.costUsd).toBeCloseTo(0.03);
    });
    it("空数组返回零值", () => {
      const usage = sumUsage([]);
      expect(usage.inputTokens).toBe(0);
      expect(usage.costUsd).toBe(0);
    });
  });

  describe("searchMessages", () => {
    it("按 content 搜索", () => {
      const results = searchMessages(sampleMessages, "hello");
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("u1");
    });
    it("空 query 返回全部", () => {
      expect(searchMessages(sampleMessages, "").length).toBe(sampleMessages.length);
    });
    it("大小写不敏感", () => {
      expect(searchMessages(sampleMessages, "HELLO").length).toBe(1);
    });
  });

  describe("summarizeMessage", () => {
    it("纯文本消息截断", () => {
      const msg = makeMsg({ content: "Short text" });
      expect(summarizeMessage(msg, 100)).toBe("Short text");
    });
    it("长文本截断到指定长度", () => {
      const long = "x".repeat(200);
      const msg = makeMsg({ content: long });
      expect(summarizeMessage(msg, 50).length).toBe(50);
    });
    it("工具调用优先展示", () => {
      const msg = makeMsg({
        content: "ignored",
        toolUses: [{ id: "t1", name: "Bash", input: { command: "ls -la" } }],
      });
      const summary = summarizeMessage(msg);
      // summarizeToolInput 对 Bash 返回 command 本身
      expect(summary).toContain("ls -la");
    });
  });

  describe("getMessageKey", () => {
    it("优先使用 id", () => {
      const msg = makeMsg({ id: "abc-123", timestamp: 12345 });
      expect(getMessageKey(msg, 0)).toBe("abc-123");
    });
    it("无 id 时用 role-timestamp", () => {
      const msg: ChatMessage = {
        role: "user", content: "", id: "", timestamp: 999,
      };
      expect(getMessageKey(msg, 0)).toBe("user-999");
    });
    it("无 id 无 timestamp 用 role-index", () => {
      const msg: ChatMessage = {
        role: "assistant", content: "", id: "", timestamp: 0,
      };
      expect(getMessageKey(msg, 5)).toBe("assistant-5");
    });
  });
});

// ── D6 new function tests ─────────────────────────────────────────────────

describe("countToolsByType", () => {
  it("按工具类型分组统计", () => {
    const msgs: ChatMessage[] = [
      makeMsg({ role: "assistant", toolUses: [
        { id: "1", name: "Bash", input: {} },
        { id: "2", name: "Bash", input: {} },
        { id: "3", name: "Write", input: {} },
      ]}),
      makeMsg({ role: "assistant", toolUses: [
        { id: "4", name: "Bash", input: {} },
      ]}),
    ];
    const stats = countToolsByType(msgs);
    expect(stats.find(s => s.name === "Bash")?.count).toBe(3);
    expect(stats.find(s => s.name === "Write")?.count).toBe(1);
  });

  it("空消息返回空数组", () => {
    expect(countToolsByType([])).toEqual([]);
  });
});

describe("computeTurnStats", () => {
  const msgs: ChatMessage[] = [
    makeMsg({ id: "u1", role: "user", content: "Q1", timestamp: 1000 }),
    makeMsg({ id: "a1", role: "assistant", content: "A1", timestamp: 2000,
      toolUses: [{ id: "t1", name: "Bash", input: {} }],
      usage: { inputTokens: 10, outputTokens: 5, costUsd: 0.001 },
    }),
    makeMsg({ id: "u2", role: "user", content: "Q2", timestamp: 3000 }),
    makeMsg({ id: "a2", role: "assistant", content: "A2", timestamp: 4000,
      usage: { inputTokens: 20, outputTokens: 10, costUsd: 0.002 },
    }),
  ];

  it("计算每轮统计", () => {
    const turns = computeTurnStats(msgs);
    expect(turns.length).toBe(2);
    expect(turns[0].userInput).toBe("Q1");
    expect(turns[0].toolCount).toBe(1);
    expect(turns[0].tokens.input).toBe(10);
    expect(turns[1].tokens.output).toBe(10);
  });

  it("无 assistant 消息也返回轮次", () => {
    const onlyUser = [makeMsg({ role: "user", content: "hi" })];
    const turns = computeTurnStats(onlyUser);
    expect(turns.length).toBe(1);
    expect(turns[0].toolCount).toBe(0);
  });
});

describe("computeSessionSummary", () => {
  it("完整会话摘要", () => {
    const msgs: ChatMessage[] = [
      makeMsg({ id: "u1", role: "user", content: "Hello", timestamp: 1000 }),
      makeMsg({ id: "a1", role: "assistant", content: "Hi", timestamp: 2000,
        toolUses: [
          { id: "t1", name: "Bash", input: {} },
          { id: "t2", name: "Write", input: {} },
        ],
        usage: { inputTokens: 100, outputTokens: 50, costUsd: 0.01 },
      }),
      makeMsg({ id: "u2", role: "user", content: "Bye", timestamp: 3000 }),
    ];
    const summary = computeSessionSummary(msgs);
    expect(summary.messageCount).toBe(3);
    expect(summary.userCount).toBe(2);
    expect(summary.assistantCount).toBe(1);
    expect(summary.toolCount).toBe(2);
    expect(summary.totalCost).toBeCloseTo(0.01);
  });

  it("空会话返回零值", () => {
    const summary = computeSessionSummary([]);
    expect(summary.messageCount).toBe(0);
    expect(summary.totalCost).toBe(0);
  });
});
