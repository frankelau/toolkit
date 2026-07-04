import { expect, test } from "vitest";
import { parsePipeTable, toMarkdownTable, detectCols } from "./pipeTableParse";

test("single-line rows split by pipes", () => {
  const raw = `| 1 | a | x |\n| 2 | b | y |`;
  const t = parsePipeTable(raw, { cols: 3 });
  expect(t.cols).toBe(3);
  expect(t.rows).toEqual([["1", "a", "x"], ["2", "b", "y"]]);
});

test("multi-line cell folded into one (SQL spanning rows)", () => {
  const raw = [
    "| 100 | user | SELECT a,",
    "b",
    "FROM t | 286 |",
    "| 101 | bob | SELECT 1 | 5 |",
  ].join("\n");
  const t = parsePipeTable(raw, { cols: 4 });
  expect(t.rows.length).toBe(2);
  expect(t.rows[0][0]).toBe("100");
  expect(t.rows[0][2]).toBe("SELECT a, b FROM t");
  expect(t.rows[0][3]).toBe("286");
  expect(t.rows[1]).toEqual(["101", "bob", "SELECT 1", "5"]);
});

test("skips markdown separator rows and blank lines", () => {
  const raw = `| a | b |\n| --- | --- |\n\n| 1 | 2 |`;
  const t = parsePipeTable(raw, { cols: 2 });
  expect(t.rows).toEqual([["a", "b"], ["1", "2"]]);
});

test("custom headers applied", () => {
  const t = parsePipeTable(`| 1 | 2 |`, { cols: 2, headers: ["编号", "值"] });
  expect(t.headers).toEqual(["编号", "值"]);
});

test("default placeholder headers when none given", () => {
  const t = parsePipeTable(`| 1 | 2 | 3 |`, { cols: 3 });
  expect(t.headers).toEqual(["列1", "列2", "列3"]);
});

test("detectCols picks the modal pipe-segment count", () => {
  const raw = `| 1 | a | x |\n| 2 | b | y |\nstray line\n| 3 | c | z |`;
  expect(detectCols(raw)).toBe(3);
});

test("toMarkdownTable renders header + separator + rows", () => {
  const md = toMarkdownTable(["A", "B"], [["1", "2"], ["3", "4"]]);
  expect(md).toBe("| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |");
});

test("toMarkdownTable escapes pipe chars inside cells", () => {
  const md = toMarkdownTable(["A"], [["a|b"]]);
  expect(md).toBe("| A |\n| --- |\n| a\\|b |");
});
