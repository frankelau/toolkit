import { expect, test } from "vitest";
import { makeRng, idCardChecksum } from "./seededRandom";

test("same seed produces same sequence", () => {
  const a = makeRng(42);
  const b = makeRng(42);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});

test("different seeds differ", () => {
  const a = makeRng(1);
  const b = makeRng(2);
  expect(a()).not.toBe(b());
});

test("values are in [0,1)", () => {
  const r = makeRng(7);
  for (let i = 0; i < 100; i++) {
    const v = r();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  }
});

test("idCardChecksum known value", () => {
  // 11010519491231002 + 校验位 X（经典示例身份证号）
  expect(idCardChecksum("11010519491231002")).toBe("X");
});

test("idCardChecksum returns single char", () => {
  const c = idCardChecksum("23010519491231000");
  expect(c).toMatch(/^[0-9X]$/);
});
