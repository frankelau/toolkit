// utils/helpers.test.ts — 通用助手函数测试
// Sprint M

import { describe, it, expect, vi } from "vitest";
import { uid, debounce, throttle, deepEqual, safeJsonParse, cx } from "./helpers";

describe("helpers", () => {
  describe("uid", () => {
    it("生成唯一 ID", () => {
      const a = uid();
      const b = uid();
      expect(a).toBeTruthy();
      expect(b).toBeTruthy();
      expect(a).not.toBe(b);
    });
    it("长度合理", () => {
      expect(uid().length).toBeGreaterThan(8);
    });
  });

  describe("debounce", () => {
    it("延迟执行", async () => {
      const mock = vi.fn();
      const fn = debounce(mock, 50);
      fn();
      fn();
      expect(mock).not.toHaveBeenCalled();
      await new Promise(r => setTimeout(r, 80));
      expect(mock).toHaveBeenCalledTimes(1);
    });
  });

  describe("throttle", () => {
    it("节流后只执行一次", async () => {
      const mock = vi.fn();
      const fn = throttle(mock, 50);
      fn();
      fn();
      fn();
      expect(mock).toHaveBeenCalledTimes(1);
      await new Promise(r => setTimeout(r, 80));
      // 节流的尾调用
      expect(mock.mock.calls.length).toBeLessThanOrEqual(2);
    });
  });

  describe("deepEqual", () => {
    it("原始类型相等", () => {
      expect(deepEqual(1, 1)).toBe(true);
      expect(deepEqual("a", "a")).toBe(true);
      expect(deepEqual(true, true)).toBe(true);
    });
    it("对象深比较", () => {
      expect(deepEqual({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] })).toBe(true);
      expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    });
    it("null/undefined 处理", () => {
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(undefined, undefined)).toBe(true);
      expect(deepEqual(null, undefined)).toBe(false);
    });
  });

  describe("safeJsonParse", () => {
    it("合法 JSON 返回解析值", () => {
      expect(safeJsonParse('{"a":1}', null)).toEqual({ a: 1 });
      expect(safeJsonParse("[1,2,3]", null)).toEqual([1, 2, 3]);
    });
    it("非法 JSON 返回 fallback", () => {
      expect(safeJsonParse("not json", null)).toBeNull();
      expect(safeJsonParse("{invalid", "default")).toBe("default");
    });
  });

  describe("cx", () => {
    it("拼接 truthy 类名", () => {
      expect(cx("a", "b", "c")).toBe("a b c");
    });
    it("过滤 falsy 值", () => {
      expect(cx("a", false, null, undefined, "", "b")).toBe("a b");
    });
    it("空输入返回空串", () => {
      expect(cx()).toBe("");
    });
  });
});
