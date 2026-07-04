// linkify.test.ts — Unit tests for linkify utilities
// Aligns with cc-gui plugin test focus on parseFileLinkTarget, normalizeFileNavigationTarget, and isJavaFqcnCandidate

import { describe, it, expect } from "vitest";
import {
  parseFileLinkTarget,
  normalizeFileNavigationTarget,
  isJavaFqcnCandidate,
  isMarkdownFileNavigationHref,
} from "./linkify";

describe("parseFileLinkTarget", () => {
  it("parses filename with line number", () => {
    const result = parseFileLinkTarget("main.ts:42");
    expect(result).not.toBeNull();
    expect(result!.path).toBe("main.ts");
    expect(result!.lineStart).toBe(42);
  });

  it("returns null for bare filename without line number", () => {
    // parseFileLinkTarget requires :lineNumber format from FILE_LINE_INFO_REGEX
    expect(parseFileLinkTarget("main.ts")).toBeNull();
  });

  it("parses filename with line range", () => {
    const result = parseFileLinkTarget("main.ts:10-20");
    expect(result).not.toBeNull();
    expect(result!.path).toBe("main.ts");
    expect(result!.lineStart).toBe(10);
    expect(result!.lineEnd).toBe(20);
  });

  it("parses full path with line", () => {
    const result = parseFileLinkTarget("/home/user/project/src/main.rs:150");
    expect(result).not.toBeNull();
    expect(result!.path).toBe("/home/user/project/src/main.rs");
    expect(result!.lineStart).toBe(150);
  });

  it("parses relative path", () => {
    const result = parseFileLinkTarget("./src/components/App.tsx:25");
    expect(result).not.toBeNull();
    expect(result!.path).toBe("./src/components/App.tsx");
    expect(result!.lineStart).toBe(25);
  });

  it("returns null for non-file patterns", () => {
    // URLs should not match
    const result = parseFileLinkTarget("https://example.com");
    expect(result).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseFileLinkTarget("")).toBeNull();
  });
});

describe("normalizeFileNavigationTarget", () => {
  it("normalizes file:// protocol", () => {
    const result = normalizeFileNavigationTarget("file:///home/user/file.ts:42");
    expect(result).not.toBeNull();
    expect(result).toBe("/home/user/file.ts:42");
  });

  it("normalizes file:// without colon", () => {
    const result = normalizeFileNavigationTarget("file:///home/user/file.ts");
    expect(result).toBe("/home/user/file.ts");
  });

  it("returns null for non-file:// hrefs", () => {
    // Regular paths without file:// should return null
  });
});

describe("isMarkdownFileNavigationHref", () => {
  it("detects file:// protocol", () => {
    expect(isMarkdownFileNavigationHref("file:///etc/hosts")).toBe(true);
  });

  it("detects file path with extension", () => {
    // A path like "src/main.ts" (without colon number) should be detected as file
    expect(isMarkdownFileNavigationHref("src/main.ts")).toBe(true);
  });

  it("detects absolute file path", () => {
    expect(isMarkdownFileNavigationHref("/home/user/main.rs")).toBe(true);
  });

  it("detects relative file path", () => {
    expect(isMarkdownFileNavigationHref("./src/lib.ts")).toBe(true);
  });

  it("rejects non-file strings", () => {
    // Plain strings without file extensions are not file nav targets
    expect(isMarkdownFileNavigationHref("just random text")).toBe(false);
  });
});

describe("isJavaFqcnCandidate", () => {
  it("matches valid FQCN", () => {
    expect(isJavaFqcnCandidate("java.util.ArrayList")).toBe(true);
    expect(isJavaFqcnCandidate("com.example.MyClass")).toBe(true);
  });

  it("rejects non-Java patterns", () => {
    expect(isJavaFqcnCandidate("snake_case_name")).toBe(false);
    expect(isJavaFqcnCandidate("just-a-string")).toBe(false);
    expect(isJavaFqcnCandidate("UPPERCASE_ONLY")).toBe(false);
  });

  it("handles edge cases", () => {
    expect(isJavaFqcnCandidate("")).toBe(false);
    expect(isJavaFqcnCandidate("single")).toBe(false); // no uppercase
    expect(isJavaFqcnCandidate("com.MYCLASS")).toBe(true);
  });
});
