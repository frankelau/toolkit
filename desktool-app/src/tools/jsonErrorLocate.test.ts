import { expect, test } from "vitest";
import { locateJsonError } from "./jsonErrorLocate";

test("valid JSON returns null", () => {
  expect(locateJsonError('{"a":1,"b":[1,2,3]}')).toBeNull();
  expect(locateJsonError('{\n  "a": 1,\n  "b": 2\n}')).toBeNull();
});

test("missing comma between properties locates the offending line", () => {
  const text = '{\n  "a": 1\n  "b": 2\n}';
  const err = locateJsonError(text);
  expect(err).not.toBeNull();
  // 错误出现在第 3 行（"b" 之前应有逗号）
  expect(err!.line).toBe(3);
});

test("missing comma in array", () => {
  const text = '[\n  1\n  2\n]';
  const err = locateJsonError(text);
  expect(err).not.toBeNull();
  expect(err!.line).toBe(3);
});

test("unclosed string", () => {
  const text = '{\n  "a": "hello\n}';
  const err = locateJsonError(text);
  expect(err).not.toBeNull();
  expect(err!.line).toBe(2);
});

test("trailing garbage after value", () => {
  const text = '{"a":1} extra';
  const err = locateJsonError(text);
  expect(err).not.toBeNull();
  expect(err!.line).toBe(1);
});

test("empty input is an error", () => {
  const err = locateJsonError("   ");
  expect(err).not.toBeNull();
});

test("error carries 1-based line and col", () => {
  const text = '{"a": }';
  const err = locateJsonError(text);
  expect(err).not.toBeNull();
  expect(err!.line).toBe(1);
  expect(err!.col).toBeGreaterThan(1);
});
