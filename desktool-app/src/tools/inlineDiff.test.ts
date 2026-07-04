import { expect, test } from "vitest";
import { inlineDiff } from "./inlineDiff";

test("identical strings are all equal", () => {
  const { left, right } = inlineDiff("abc", "abc");
  expect(left).toEqual([{ type: "eq", text: "abc" }]);
  expect(right).toEqual([{ type: "eq", text: "abc" }]);
});

test("pure insertion", () => {
  const { left, right } = inlineDiff("ac", "abc");
  expect(left.filter((s) => s.type === "del")).toEqual([]);
  expect(right.filter((s) => s.type === "ins").map((s) => s.text).join("")).toBe("b");
  expect(right.map((s) => s.text).join("")).toBe("abc");
});

test("pure deletion", () => {
  const { left, right } = inlineDiff("abc", "ac");
  expect(left.filter((s) => s.type === "del").map((s) => s.text).join("")).toBe("b");
  expect(left.map((s) => s.text).join("")).toBe("abc");
  expect(right.filter((s) => s.type === "ins")).toEqual([]);
});

test("substitution shows del on left and ins on right", () => {
  const { left, right } = inlineDiff("cat", "cot");
  expect(left.map((s) => s.text).join("")).toBe("cat");
  expect(right.map((s) => s.text).join("")).toBe("cot");
  expect(left.some((s) => s.type === "del" && s.text === "a")).toBe(true);
  expect(right.some((s) => s.type === "ins" && s.text === "o")).toBe(true);
});

test("empty vs non-empty", () => {
  const { left, right } = inlineDiff("", "ab");
  expect(left).toEqual([]);
  expect(right).toEqual([{ type: "ins", text: "ab" }]);
});
