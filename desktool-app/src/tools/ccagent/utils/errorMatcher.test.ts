// errorMatcher.test.ts
// Aligns with cc-gui errorMatcher.test.ts

import { describe, it, expect } from "vitest";
import { matchErrorPattern } from "./errorMatcher";

describe("matchErrorPattern", () => {
  it("matches command not found", () => {
    const result = matchErrorPattern("bash: node: command not found");
    expect(result).not.toBeNull();
    expect(result!.id).toMatch(/^err-/);
    expect(result!.title).toBe("命令未找到");
  });

  it("matches Windows command not found", () => {
    const result = matchErrorPattern("'python' is not recognized as an internal or external command");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("命令未找到");
  });

  it("matches permission denied", () => {
    const result = matchErrorPattern("EACCES: permission denied, open '/etc/hosts'");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("权限不足");
    expect(result!.settingsLink).toBe("permissions");
  });

  it("matches 401 unauthorized", () => {
    const result = matchErrorPattern("HTTP 401 Unauthorized - invalid api key");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("API Key 无效");
    expect(result!.settingsLink).toBe("provider");
  });

  it("matches 429 rate limit", () => {
    const result = matchErrorPattern("429 Too Many Requests - rate limit exceeded");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("请求频率超限");
  });

  it("matches context length exceed", () => {
    const result = matchErrorPattern("Error: context length exceeded the maximum context window of 200k");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("上下文超长");
  });

  it("matches network error", () => {
    const result = matchErrorPattern("getaddrinfo ENOTFOUND api.example.com");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("网络连接失败");
  });

  it("matches ENOENT", () => {
    const result = matchErrorPattern("ENOENT: no such file or directory, open 'test.txt'");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("文件不存在");
  });

  it("matches EADDRINUSE", () => {
    const result = matchErrorPattern("EADDRINUSE: address already in use :::3000");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("端口被占用");
  });

  it("returns null for unknown error", () => {
    const result = matchErrorPattern("something completely unexpected happened");
    expect(result).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(matchErrorPattern("")).toBeNull();
  });

  it("returns correct id format", () => {
    const r1 = matchErrorPattern("command not found");
    const r2 = matchErrorPattern("permission denied");
    expect(r1!.id).not.toBe(r2!.id);
    expect(r1!.id).toMatch(/^err-\d+$/);
  });
});
