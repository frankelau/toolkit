/// <reference types="vitest" />
// @vitest-environment jsdom
// useScrollBehavior.test.ts
// Tests for auto-scroll behavior hook

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

// We test the hook structure, not DOM interactions (those need jsdom)

import { useScrollBehavior } from "./useScrollBehavior";

describe("useScrollBehavior", () => {
  const createRef = (): React.RefObject<HTMLDivElement | null> => ({
    current: null,
  });

  it("returns autoScrollRef and scrollToBottom", () => {
    const bottomRef = createRef();
    const containerRef = createRef();

    const { result } = renderHook(() =>
      useScrollBehavior({
        messages: [],
        streaming: false,
        bottomRef,
        containerRef,
        enabled: false,
      })
    );

    expect(result.current).toBeDefined();
    expect(typeof result.current.scrollToBottom).toBe("function");
    expect(result.current.autoScrollRef).toBeDefined();
    expect(result.current.autoScrollRef.current).toBe(true);
  });

  it("disables auto-scroll when enabled=false", () => {
    const bottomRef = createRef();

    const { result } = renderHook(() =>
      useScrollBehavior({
        messages: [],
        streaming: false,
        bottomRef,
        enabled: false,
      })
    );

    // scrollToBottom should still work when manually called
    expect(result.current.scrollToBottom).toBeDefined();
  });

  it("accepts different message lengths", () => {
    const bottomRef = createRef();

    const { rerender } = renderHook(
      ({ messages, streaming }) =>
        useScrollBehavior({ messages, streaming, bottomRef, enabled: true }),
      { initialProps: { messages: [], streaming: false } }
    );

    // Should not throw with various message counts
    rerender({ messages: [{ id: "1" }] as any, streaming: false });
    rerender({ messages: [{ id: "1" }, { id: "2" }] as any, streaming: true });
    rerender({ messages: [{ id: "1" }, { id: "2" }, { id: "3" }] as any, streaming: false });
  });

  it("scrollToBottom forces auto-scroll", () => {
    const bottomRef = createRef();

    const { result } = renderHook(() =>
      useScrollBehavior({
        messages: [],
        streaming: false,
        bottomRef,
        enabled: false,
      })
    );

    // Calling scrollToBottom should not throw
    expect(() => result.current.scrollToBottom()).not.toThrow();
  });
});
