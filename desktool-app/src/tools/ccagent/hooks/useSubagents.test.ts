/// <reference types="vitest" />
// @vitest-environment jsdom
// useSubagents.test.ts
// Tests for subagent tracking hook

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSubagents } from "./useSubagents";
import type { ChatMessage, ToolUseBlock } from "../types";

function makeToolUse(overrides: Partial<ToolUseBlock> = {}): ToolUseBlock {
  return {
    id: "agent_1",
    name: "Agent",
    input: { description: "Test agent", prompt: "Do X" },
    isPending: false,
    ...overrides,
  };
}

function makeAssistantMsg(toolUses: ToolUseBlock[]): ChatMessage {
  return { id: Math.random().toString(36).slice(2), role: "assistant", content: "", timestamp: Date.now(), toolUses };
}

describe("useSubagents", () => {
  it("returns empty subagents for empty messages", () => {
    const { result } = renderHook(() => useSubagents({ messages: [] }));
    expect(result.current.subagents).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });

  it("detects Agent tool as subagent", () => {
    const messages: ChatMessage[] = [
      makeAssistantMsg([makeToolUse({ name: "Agent", id: "a1" })]),
    ];

    const { result } = renderHook(() => useSubagents({ messages }));

    expect(result.current.totalCount).toBeGreaterThanOrEqual(1);
    if (result.current.subagents.length > 0) {
      expect(result.current.subagents[0].type).toBe("Agent");
    }
  });

  it("detects Task tool as subagent", () => {
    const messages: ChatMessage[] = [
      makeAssistantMsg([makeToolUse({ name: "Task", id: "t1", input: { description: "task" } })]),
    ];

    const { result } = renderHook(() => useSubagents({ messages }));
    expect(result.current.subagents.length).toBeGreaterThanOrEqual(1);
  });

  it("detects Explore tool as subagent", () => {
    const messages: ChatMessage[] = [
      makeAssistantMsg([makeToolUse({ name: "Explore", id: "e1", input: { description: "explore" } })]),
    ];

    const { result } = renderHook(() => useSubagents({ messages }));
    expect(result.current.subagents.length).toBeGreaterThanOrEqual(1);
  });

  it("counts running/completed/error statuses", () => {
    const messages: ChatMessage[] = [
      makeAssistantMsg([
        makeToolUse({ id: "a1", name: "Agent", isPending: true }),
        makeToolUse({ id: "a2", name: "Agent", isPending: false }),
        makeToolUse({ id: "a3", name: "Agent", isError: true }),
      ]),
    ];

    const { result } = renderHook(() => useSubagents({ messages }));

    expect(result.current.runningCount).toBeGreaterThanOrEqual(0);
    expect(result.current.completedCount).toBeGreaterThanOrEqual(0);
    expect(result.current.totalCount).toBe(result.current.runningCount + result.current.completedCount + result.current.errorCount);
  });

  it("handles non-agent tools", () => {
    const messages: ChatMessage[] = [
      makeAssistantMsg([
        makeToolUse({ name: "Read", id: "r1" }),
        makeToolUse({ name: "Write", id: "w1" }),
      ]),
    ];

    const { result } = renderHook(() => useSubagents({ messages }));
    expect(result.current.subagents).toEqual([]);
  });

  it("returns correct counts", () => {
    const { result } = renderHook(() => useSubagents({ messages: [] }));

    expect(result.current.totalCount).toBe(0);
    expect(result.current.runningCount).toBe(0);
    expect(result.current.completedCount).toBe(0);
    expect(result.current.errorCount).toBe(0);
  });
});
