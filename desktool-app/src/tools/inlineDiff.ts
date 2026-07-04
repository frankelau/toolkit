export type DiffSeg = { type: "eq" | "del" | "ins"; text: string };

/** 字符级 LCS diff。返回左右两侧的分段：left 含 eq+del，right 含 eq+ins。 */
export function inlineDiff(a: string, b: string): { left: DiffSeg[]; right: DiffSeg[] } {
  const n = a.length;
  const m = b.length;
  // LCS 长度表
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const left: DiffSeg[] = [];
  const right: DiffSeg[] = [];
  let i = 0;
  let j = 0;
  const pushSeg = (arr: DiffSeg[], type: DiffSeg["type"], ch: string) => {
    const last = arr[arr.length - 1];
    if (last && last.type === type) last.text += ch;
    else arr.push({ type, text: ch });
  };
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pushSeg(left, "eq", a[i]);
      pushSeg(right, "eq", b[j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pushSeg(left, "del", a[i]);
      i++;
    } else {
      pushSeg(right, "ins", b[j]);
      j++;
    }
  }
  while (i < n) { pushSeg(left, "del", a[i]); i++; }
  while (j < m) { pushSeg(right, "ins", b[j]); j++; }
  return { left, right };
}
