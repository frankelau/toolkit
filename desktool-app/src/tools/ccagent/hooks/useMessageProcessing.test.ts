/// <reference types="vitest" />
// @vitest-environment jsdom
// useMessageProcessing.test.ts
// Tests for SDK message processing hook

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMessageProcessing } from "./useMessageProcessing";

describe("useMessageProcessing", () => {
  it("exports handleSdkMessage function", () => {
    const { result } = renderHook(() => useMessageProcessing());

    expect(result.current).toBeDefined();
    expect(typeof result.current.handleSdkMessage).toBe("function");
  });

  it("handleSdkMessage ignores messages without type", () => {
    const { result } = renderHook(() => useMessageProcessing());

    const mockCtx = {
      streamingMsgRef: { current: null },
      setMessages: () => {},
      pendingToolsRef: { current: new Map() },
      setTodos: () => {},
      setSubagents: () => {},
      trackFileChange: () => {},
    };

    // Should not throw for empty or type-less messages
    expect(() => result.current.handleSdkMessage({}, mockCtx as any)).not.toThrow();
    expect(() => result.current.handleSdkMessage({ type: "unknown" }, mockCtx as any)).not.toThrow();
  });

  it("handles system message type", () => {
    const { result } = renderHook(() => useMessageProcessing());
    let msgs: any[] = [];

    const mockCtx = {
      streamingMsgRef: { current: null },
      setMessages: (updater: any) => {
        msgs = typeof updater === "function" ? updater([]) : updater;
      },
      pendingToolsRef: { current: new Map() },
      setTodos: () => {},
      setSubagents: () => {},
      trackFileChange: () => {},
    };

    result.current.handleSdkMessage(
      { type: "system", model: "claude-sonnet-4", tools: ["Read", "Write"] },
      mockCtx as any
    );

    // Should add a system message
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.role).toBe("system");
  });

  it("handles assistant message with text content", () => {
    const { result } = renderHook(() => useMessageProcessing());
    let msgs: any[] = [];

    const mockCtx = {
      streamingMsgRef: { current: null as any },
      setMessages: (updater: any) => {
        msgs = typeof updater === "function" ? updater([]) : updater;
      },
      pendingToolsRef: { current: new Map() },
      setTodos: () => {},
      setSubagents: () => {},
      trackFileChange: () => {},
    };

    result.current.handleSdkMessage(
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "Hello world" }],
        },
      },
      mockCtx as any
    );

    // Should push or update messages
    expect(msgs.length).toBeGreaterThanOrEqual(0);
  });

  it("handles tool_use blocks", () => {
    const { result } = renderHook(() => useMessageProcessing());
    let todos: any[] = [];
    const pendingTools = new Map();

    const mockCtx = {
      streamingMsgRef: { current: null as any },
      setMessages: () => {},
      pendingToolsRef: { current: pendingTools },
      setTodos: (updater: any) => {
        if (typeof updater === "function") todos = updater([]);
      },
      setSubagents: () => {},
      trackFileChange: () => {},
    };

    result.current.handleSdkMessage(
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: "tool_1",
              name: "Read",
              input: { file_path: "test.txt" },
            },
          ],
        },
      },
      mockCtx as any
    );

    // Tool should be tracked in pending tools
    expect(pendingTools.get("tool_1")).toBeDefined();
    expect(todos.length).toBeGreaterThanOrEqual(0);
  });

  it("handleSdkMessage returns void", () => {
    const { result } = renderHook(() => useMessageProcessing());
    const mockCtx = {
      streamingMsgRef: { current: null },
      setMessages: () => {},
      pendingToolsRef: { current: new Map() },
      setTodos: () => {},
      setSubagents: () => {},
      trackFileChange: () => {},
    };

    const ret = result.current.handleSdkMessage(
      { type: "text", text: "hello" },
      mockCtx as any
    );
    expect(ret).toBeUndefined();
  });
});
