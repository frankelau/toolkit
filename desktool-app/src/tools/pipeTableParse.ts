export interface PipeTable {
  headers: string[];
  rows: string[][];
  cols: number;
}

/** 一行的「管道段数」：去掉首尾管道后按 | 切分的段数 */
function segmentCount(line: string): number {
  const t = line.trim();
  if (!t.startsWith("|")) return 0;
  // 去首尾管道，按 | 切，统计段数
  const inner = t.replace(/^\|/, "").replace(/\|\s*$/, "");
  return inner.split("|").length;
}

/** 是否 markdown 分隔行（| --- | --- |） */
function isSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
}

/** 探测列数：取所有以 | 开头的行的管道段数中出现最多的那个 */
export function detectCols(raw: string): number {
  const counts = new Map<number, number>();
  for (const line of raw.split("\n")) {
    if (isSeparator(line)) continue;
    const n = segmentCount(line);
    if (n >= 2) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  let best = 0;
  let bestFreq = 0;
  for (const [n, f] of counts) {
    if (f > bestFreq) {
      best = n;
      bestFreq = f;
    }
  }
  return best;
}

/** 把一行按 | 切成单元格（去首尾管道、trim、折叠内部空白） */
function splitCells(line: string): string[] {
  const t = line.trim().replace(/^\|/, "").replace(/\|\s*$/, "");
  return t.split("|").map((c) => c.trim().replace(/\s+/g, " "));
}

export function parsePipeTable(
  raw: string,
  opts?: { cols?: number; headers?: string[] },
): PipeTable {
  const cols = opts?.cols && opts.cols >= 2 ? opts.cols : detectCols(raw);
  const lines = raw.split("\n");
  const rows: string[][] = [];
  let current: string[] | null = null;

  const flush = () => {
    if (current) {
      // 补齐/截断到 cols 列
      while (current.length < cols) current.push("");
      if (current.length > cols) {
        // 多出的并入最后一列（极少见）
        const tail = current.slice(cols - 1).join(" | ");
        current = [...current.slice(0, cols - 1), tail];
      }
      rows.push(current);
      current = null;
    }
  };

  for (const line of lines) {
    if (line.trim() === "") continue;
    if (isSeparator(line)) continue;
    const startsWithPipe = line.trim().startsWith("|");
    const sc = segmentCount(line);
    const isNewRow = startsWithPipe && sc >= 1;

    if (isNewRow) {
      flush();
      current = splitCells(line);
    } else if (current && line.includes("|")) {
      // Continuation line with pipes — split and distribute cells.
      // NOTE: cells containing literal | (e.g. SQL || concat operator) may over-segment;
      // parsing is by column count and tuned for MySQL processlist output.
      const cells = splitCells(line);
      if (cells.length > 0) {
        // First cell continues the last cell
        current[current.length - 1] = (current[current.length - 1] + " " + cells[0]).trim();
        // Remaining cells fill new columns
        for (let i = 1; i < cells.length && current.length < cols; i++) {
          current.push(cells[i]);
        }
        if (current.length >= cols) {
          flush();
        }
      }
    } else if (current) {
      // 续行：折叠进最后一个单元格
      const cont = line.trim().replace(/\|\s*$/, "").replace(/\s+/g, " ");
      current[current.length - 1] = (current[current.length - 1] + " " + cont).trim();
    }
    // 不在记录中又非新行 → 忽略（杂散行）
  }
  flush();

  const headers =
    opts?.headers && opts.headers.length
      ? opts.headers
      : Array.from({ length: cols }, (_, i) => `列${i + 1}`);

  return { headers, rows, cols };
}

/** 转义单元格内的管道符，避免破坏 Markdown 表格结构 */
function escapeCell(s: string): string {
  return s.replace(/\|/g, "\\|");
}

export function toMarkdownTable(headers: string[], rows: string[][]): string {
  const head = `| ${headers.map(escapeCell).join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.map(escapeCell).join(" | ")} |`).join("\n");
  return body ? `${head}\n${sep}\n${body}` : `${head}\n${sep}`;
}
