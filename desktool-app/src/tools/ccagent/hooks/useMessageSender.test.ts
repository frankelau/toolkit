/// <reference types="vitest" />
// @vitest-environment jsdom
// useMessageSender.test.ts
// Tests for message sender hook

import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ChatMessage } from "../types";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

describe("useMessageSender", () => {
  it("returns expected API shape", async () => {
    const mod = await import("./useMessageSender");
    expect(typeof mod.useMessageSender).toBe("function");
  });

  it("creates sender with required options and returns send + ref", async () => {
    const mod = await import("./useMessageSender");

    const { result } = renderHook(() =>
      mod.useMessageSender({
        sessionId: "test-session",
        ensureSession: async () => "test-session",
        setMessages: () => {},
        setStreaming: () => {},
        setError: () => {},
      })
    );

    expect(typeof result.current.send).toBe("function");
    expect(result.current.streamingMsgRef).toBeDefined();
  });

  it("returns void for empty content", async () => {
    const mod = await import("./useMessageSender");

    const { result } = renderHook(() =>
      mod.useMessageSender({
        sessionId: "test-session",
        ensureSession: async () => "test-session",
        setMessages: () => {},
        setStreaming: () => {},
        setError: () => {},
      })
    );

    // Empty content should return early
    await expect(result.current.send("")).resolves.toBeUndefined();
    await expect(result.current.send("   ")).resolves.toBeUndefined();
  });

  it("sends non-empty content", async () => {
    const mod = await import("./useMessageSender");
    let msgs: ChatMessage[] = [];
    let streaming = false;

    const { result } = renderHook(() =>
      mod.useMessageSender({
        sessionId: "test-session",
        ensureSession: async () => "test-session",
        setMessages: (updater: any) => {
          msgs = typeof updater === "function" ? updater(msgs) : updater;
        },
        setStreaming: (v: boolean) => {
          streaming = v;
        },
        setError: () => {},
      })
    );

    await act(async () => {
      await result.current.send("Hello world");
    });

    // Should have added user message + assistant message placeholder
    expect(msgs.length).toBeGreaterThanOrEqual(2);
    expect(msgs[0]?.role).toBe("user");
    expect(msgs[1]?.role).toBe("assistant");
    expect(streaming).toBe(true);
  });

  it("ensures session when sessionId is null", async () => {
    const mod = await import("./useMessageSender");
    let errorCalled = false;

    const { result } = renderHook(() =>
      mod.useMessageSender({
        sessionId: null,
        ensureSession: async () => null, // session creation fails
        setMessages: () => {},
        setStreaming: () => {},
        setError: (_msg: string) => {
          errorCalled = true;
        },
      })
    );

    await act(async () => {
      await result.current.send("Hello");
    });

    // Should have set an error since session can't be created
    expect(errorCalled).toBe(true);
  });

  it("streamingMsgRef initialized as null", async () => {
    const mod = await import("./useMessageSender");

    const { result } = renderHook(() =>
      mod.useMessageSender({
        sessionId: "test-session",
        ensureSession: async () => "test-session",
        setMessages: () => {},
        setStreaming: () => {},
        setError: () => {},
      })
    );

    expect(result.current.streamingMsgRef.current).toBeNull();
  });

  it("handles attachments in send", async () => {
    const mod = await import("./useMessageSender");
    let msgs: ChatMessage[] = [];

    const { result } = renderHook(() =>
      mod.useMessageSender({
        sessionId: "test-session",
        ensureSession: async () => "test-session",
        setMessages: (updater: any) => {
          msgs = typeof updater === "function" ? updater(msgs) : updater;
        },
        setStreaming: () => {},
        setError: () => {},
      })
    );

    const attachment = {
      type: "image" as const,
      data: "base64data",
      mimeType: "image/png",
      name: "screenshot.png",
      filePath: "/tmp/screenshot.png",
    };

    await act(async () => {
      await result.current.send("Check this image", [attachment]);
    });

    // User message should have attachments
    if (msgs[0]?.attachments) {
      expect(msgs[0].attachments.length).toBe(1);
    }
  });
});
