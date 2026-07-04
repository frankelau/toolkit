/// <reference types="vitest" />
// @vitest-environment jsdom
// useStreamingMessages.test.ts
// Tests for streaming message processing hook

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

// Dynamic import to avoid issues with complex dependencies
describe("useStreamingMessages", () => {
  it("accepts required options and returns handlers", async () => {
    const mod = await import("./useStreamingMessages");
    // Verify the hook exists and can be called
    expect(typeof mod.useStreamingMessages).toBe("function");
  });

  it("returns handleSdkMessage function", async () => {
    const mod = await import("./useStreamingMessages");

    const { result } = renderHook(() =>
      mod.useStreamingMessages({
        streamingMsgRef: { current: null },
        setMessages: () => {},
        setStreaming: () => {},
        setIsThinking: () => {},
        setTodos: () => {},
        setSubagents: () => {},
      })
    );

    expect(result.current).toBeDefined();
    expect(typeof result.current.handleSdkMessage).toBe("function");
  });

  it("ignoreSdkEvent helper exists", async () => {
    const mod = await import("./useStreamingMessages");

    const { result } = renderHook(() =>
      mod.useStreamingMessages({
        streamingMsgRef: { current: null },
        setMessages: () => {},
        setStreaming: () => {},
        setIsThinking: () => {},
        setTodos: () => {},
        setSubagents: () => {},
      })
    );

    // handleSdkMessage should not throw on empty/unknown events
    expect(() =>
      result.current.handleSdkMessage({ type: "unknown" })
    ).not.toThrow();
  });

  it("handles stream events without crashing", async () => {
    const mod = await import("./useStreamingMessages");

    const { result } = renderHook(() =>
      mod.useStreamingMessages({
        streamingMsgRef: { current: null },
        setMessages: () => {},
        setStreaming: () => {},
        setIsThinking: () => {},
        setTodos: () => {},
        setSubagents: () => {},
      })
    );

    // Various stream event types
    expect(() => result.current.handleSdkMessage({ type: "system" })).not.toThrow();
    expect(() => result.current.handleSdkMessage({ type: "result" })).not.toThrow();
    expect(() => result.current.handleSdkMessage({ type: "" } as any)).not.toThrow();
  });
});
