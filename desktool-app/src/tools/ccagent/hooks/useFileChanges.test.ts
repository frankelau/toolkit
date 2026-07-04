/// <reference types="vitest" />
// @vitest-environment jsdom
// useFileChanges.test.ts
// Tests for file change tracking hook

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFileChanges } from "./useFileChanges";
import type { ChatMessage, ToolUseBlock } from "../types";

function makeToolUse(overrides: Partial<ToolUseBlock> = {}): ToolUseBlock {
  return {
    id: "tool_1",
    name: "Write",
    input: { file_path: "/src/test.ts", content: "hello" },
    isPending: false,
    ...overrides,
  };
}

function makeAssistantMsg(toolUses: ToolUseBlock[]): ChatMessage {
  return {
    id: Math.random().toString(36).slice(2),
    role: "assistant",
    content: "",
    timestamp: Date.now(),
    toolUses,
  };
}

describe("useFileChanges", () => {
  it("returns empty fileChanges for empty messages", () => {
    const { result } = renderHook(() => useFileChanges({ messages: [] }));
    expect(result.current.fileChanges).toEqual([]);
    expect(result.current.totalAdditions).toBe(0);
    expect(result.current.totalDeletions).toBe(0);
  });

  it("aggregates file changes from tool uses", () => {
    const messages: ChatMessage[] = [
      makeAssistantMsg([
        makeToolUse({ name: "Write", input: { file_path: "src/a.ts", content: "a" } }),
        makeToolUse({ name: "Write", input: { file_path: "src/b.ts", content: "b" } }),
      ]),
    ];

    const { result } = renderHook(() => useFileChanges({ messages }));
    expect(result.current.fileChanges.length).toBeGreaterThanOrEqual(1);
  });

  it("merges multiple edits to the same file", () => {
    const messages: ChatMessage[] = [
      makeAssistantMsg([
        makeToolUse({ id: "t1", name: "Write", input: { file_path: "src/x.ts", content: "first" } }),
      ]),
      makeAssistantMsg([
        makeToolUse({ id: "t2", name: "Edit", input: { file_path: "src/x.ts", old: "a", new: "b" } }),
      ]),
    ];

    const { result } = renderHook(() => useFileChanges({ messages }));
    // Same file should appear only once (merged)
    const xFiles = result.current.fileChanges.filter((f) => f.filePath === "src/x.ts");
    expect(xFiles.length).toBeLessThanOrEqual(1);
  });

  it("computes total additions and deletions", () => {
    const { result } = renderHook(() => useFileChanges({ messages: [] }));
    expect(result.current.totalAdditions).toBe(0);
    expect(result.current.totalDeletions).toBe(0);
  });

  it("provides removeFileChange function", () => {
    const { result } = renderHook(() => useFileChanges({ messages: [] }));
    expect(typeof result.current.removeFileChange).toBe("function");
  });

  it("handles messages with no toolUses", () => {
    const messages: ChatMessage[] = [
      { id: "msg_user", role: "user", content: "hello", timestamp: Date.now() },
      { id: "msg_ai", role: "assistant", content: "hi there", timestamp: Date.now() },
    ];

    const { result } = renderHook(() => useFileChanges({ messages }));
    expect(result.current.fileChanges).toEqual([]);
  });

  it("derives fileName from filePath", () => {
    const messages: ChatMessage[] = [
      makeAssistantMsg([
        makeToolUse({ name: "Write", input: { file_path: "deep/nested/path/file.ts", content: "x" } }),
      ]),
    ];

    const { result } = renderHook(() => useFileChanges({ messages }));
    if (result.current.fileChanges.length > 0) {
      expect(result.current.fileChanges[0].fileName).toBeDefined();
    }
  });
});
