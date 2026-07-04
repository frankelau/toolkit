/** 对齐后逐行比较两侧文本，给出每行高亮标签 */

export type LineTag = "same" | "added" | "diff" | "gap";

export interface LineCompare {
  leftTags: LineTag[];
  rightTags: LineTag[];
  added: number;
  diff: number;
}

function normalizeLine(
  s: string,
  opts?: { ignoreCase?: boolean; ignoreWhitespace?: boolean },
): string {
  let r = s;
  if (opts?.ignoreWhitespace) r = r.replace(/\s+/g, " ").trim();
  if (opts?.ignoreCase) r = r.toLowerCase();
  return r;
}

/**
 * 按相同 index 逐行比较（假定两侧已通过对齐插入空行占位）。
 * - 一侧空、另一侧有内容 → 有内容的一侧 added（绿），空侧 gap（斜纹）
 * - 两侧都有但归一化后不同 → diff（红）
 * - 相同 → same
 * 若行数不同（未对齐），多出的行按 added 处理。
 * opts.ignoreCase: 忽略大小写；opts.ignoreWhitespace: 忽略多余空白
 */
export function compareLines(
  leftText: string,
  rightText: string,
  opts?: { ignoreCase?: boolean; ignoreWhitespace?: boolean },
): LineCompare {
  const a = leftText.split("\n");
  const b = rightText.split("\n");
  const n = Math.max(a.length, b.length);
  const leftTags: LineTag[] = [];
  const rightTags: LineTag[] = [];
  let added = 0;
  let diff = 0;

  for (let i = 0; i < n; i++) {
    const l = a[i];
    const r = b[i];
    const lEmpty = l === undefined || l.trim() === "";
    const rEmpty = r === undefined || r.trim() === "";

    if (lEmpty && rEmpty) {
      leftTags.push(l === undefined ? "gap" : "same");
      rightTags.push(r === undefined ? "gap" : "same");
    } else if (lEmpty && !rEmpty) {
      leftTags.push("gap");
      rightTags.push("added");
      added++;
    } else if (!lEmpty && rEmpty) {
      leftTags.push("added");
      rightTags.push("gap");
      added++;
    } else if (normalizeLine(l, opts) === normalizeLine(r, opts)) {
      leftTags.push("same");
      rightTags.push("same");
    } else {
      leftTags.push("diff");
      rightTags.push("diff");
      diff++;
    }
  }

  return { leftTags, rightTags, added, diff };
}
