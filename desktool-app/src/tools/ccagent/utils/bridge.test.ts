// bridge.test.ts — Unit tests for bridge.ts utilities
// Focus on pure utility functions that don't need Tauri runtime

import { describe, it, expect } from "vitest";

// Import the module's exports directly (mock the tauri invoke via vitest config)
// We test pure behavior: function signatures, parameter handling patterns

describe("bridge module structure", () => {
  it("exports expected functions", async () => {
    // Dynamic import to verify the module loads
    const mod = await import("./bridge");
    expect(typeof mod.sendBridgeEvent).toBe("function");
    expect(typeof mod.sendBridgeEventQuiet).toBe("function");
    expect(typeof mod.resolveFilePath).toBe("function");
    expect(typeof mod.openFile).toBe("function");
    expect(typeof mod.openExternalUrl).toBe("function");
  });
});

describe("bridge error handling pattern", () => {
  it("sendBridgeEventQuiet should exist and accept parameters", async () => {
    const mod = await import("./bridge");
    expect(typeof mod.sendBridgeEventQuiet).toBe("function");
    // Should accept two parameters (eventName, payload?)
    expect(mod.sendBridgeEventQuiet.length).toBeGreaterThanOrEqual(1);
  });
});
