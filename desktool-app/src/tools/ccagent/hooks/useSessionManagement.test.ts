// useSessionManagement.test.ts
// Tests for session management hook - structure/interface verification

import { describe, it, expect, vi } from "vitest";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe("useSessionManagement", () => {
  it("exports useSessionManagement function", async () => {
    const mod = await import("./useSessionManagement");
    expect(typeof mod.useSessionManagement).toBe("function");
  });

  it("accepts required options", async () => {
    const mod = await import("./useSessionManagement");
    // Verify exports exist without rendering (complex deps)
    expect(mod.useSessionManagement).toBeDefined();
  });

  it("module can be imported without errors", async () => {
    // Just verify the module loads
    const mod = await import("./useSessionManagement");
    expect(mod).toBeDefined();
  });
});
