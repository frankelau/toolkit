import { expect, test } from "vitest";
import { compareLines } from "./lineCompare";

test("identical lines: no diffs", () => {
  const r = compareLines('{"a":1}', '{"a":1}');
  expect(r.diff).toBe(0);
  expect(r.added).toBe(0);
});

test("ignoreCase treats Aa as equal", () => {
  const base = compareLines("ABC", "abc");
  expect(base.diff).toBe(1);
  const ign = compareLines("ABC", "abc", { ignoreCase: true });
  expect(ign.diff).toBe(0);
});

test("ignoreWhitespace collapses spaces", () => {
  const base = compareLines("a   b", "a b");
  expect(base.diff).toBe(1);
  const ign = compareLines("a   b", "a b", { ignoreWhitespace: true });
  expect(ign.diff).toBe(0);
});
