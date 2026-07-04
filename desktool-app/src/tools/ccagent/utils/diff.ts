// diff.ts — Diff 计算（LCS 算法）

import type { DiffHunk, DiffResult, EditOperation } from "../types";

export function computeDiff(oldText: string, newText: string): DiffHunk[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const m = oldLines.length, n = newLines.length;

  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const hunks: DiffHunk[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      hunks.unshift({ type: "ctx", text: oldLines[i - 1], oldLine: i, newLine: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      hunks.unshift({ type: "add", text: newLines[j - 1], newLine: j });
      j--;
    } else {
      hunks.unshift({ type: "del", text: oldLines[i - 1], oldLine: i });
      i--;
    }
  }
  return hunks;
}

export function countLines(text: string): number {
  if (!text) return 0;
  return text.split("\n").length;
}

export function buildEditOperation(toolName: string, input: Record<string, unknown>): EditOperation {
  if (toolName === "Write") {
    const content = String(input.content ?? "");
    return { toolName, oldString: "", newString: content, additions: countLines(content), deletions: 0 };
  }
  if (toolName === "Edit") {
    const oldStr = String(input.old_string ?? "");
    const newStr = String(input.new_string ?? "");
    return { toolName, oldString: oldStr, newString: newStr, additions: countLines(newStr), deletions: countLines(oldStr) };
  }
  if (toolName === "MultiEdit") {
    const edits = (input.edits as Array<{ old_string?: string; new_string?: string }>) ?? [];
    const adds = edits.reduce((s, e) => s + countLines(String(e.new_string ?? "")), 0);
    const dels = edits.reduce((s, e) => s + countLines(String(e.old_string ?? "")), 0);
    const oldStr = edits.map(e => e.old_string ?? "").join("\n");
    const newStr = edits.map(e => e.new_string ?? "").join("\n");
    return { toolName, oldString: oldStr, newString: newStr, additions: adds, deletions: dels };
  }
  return { toolName, oldString: "", newString: "", additions: 0, deletions: 0 };
}

export function buildDiffForTool(name: string, input: Record<string, unknown>): DiffResult | undefined {
  if (name === "Write" && input.file_path && input.content) {
    return {
      filePath: String(input.file_path),
      oldContent: null,
      newContent: String(input.content),
      hunks: [{ type: "add", text: String(input.content) }],
    };
  }
  if (name === "Edit" && input.file_path && input.new_string) {
    const oldStr = String(input.old_string ?? "");
    const newStr = String(input.new_string);
    return {
      filePath: String(input.file_path),
      oldContent: oldStr,
      newContent: newStr,
      hunks: computeDiff(oldStr, newStr),
    };
  }
  if (name === "MultiEdit" && input.file_path && input.edits) {
    const edits = input.edits as Array<{ old_string?: string; new_string: string }>;
    const combined = edits.map(e => e.new_string).join("\n");
    return {
      filePath: String(input.file_path),
      oldContent: edits.map(e => e.old_string ?? "").join("\n"),
      newContent: combined,
      hunks: computeDiff(edits.map(e => e.old_string ?? "").join("\n"), combined),
    };
  }
  return undefined;
}
