import { expect, test, vi } from "vitest";

test("shortcutHint returns ctrl form when not mac", async () => {
  vi.stubGlobal("navigator", { platform: "Win32", userAgent: "Windows" });
  const { shortcutHint } = await import("./shortcuts");
  expect(shortcutHint("run")).toBe("Ctrl+Enter");
  expect(shortcutHint("export")).toBe("Ctrl+S");
});

test("matchShortcut detects ctrl+enter for run", async () => {
  vi.stubGlobal("navigator", { platform: "Win32", userAgent: "Windows" });
  const { matchShortcut } = await import("./shortcuts");
  const e = { key: "Enter", ctrlKey: true, metaKey: false } as KeyboardEvent;
  expect(matchShortcut(e, "run")).toBe(true);
  const e2 = { key: "Enter", ctrlKey: false, metaKey: false } as KeyboardEvent;
  expect(matchShortcut(e2, "run")).toBe(false);
});
