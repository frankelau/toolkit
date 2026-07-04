// i18n/config.test.ts — i18n 配置测试
// Sprint M: 对齐 cc-gui 的测试结构

import { describe, it, expect, beforeEach } from "vitest";
import { getLocale, setLocale, t, onLocaleChange, type Locale } from "./config";

describe("i18n/config", () => {
  describe("getLocale / setLocale", () => {
    it("setLocale 应能切换语言", () => {
      setLocale("en-US");
      expect(getLocale()).toBe("en-US");
      setLocale("zh-CN");
      expect(getLocale()).toBe("zh-CN");
    });
  });

  describe("onLocaleChange", () => {
    it("语言切换时触发监听器", () => {
      const calls: Locale[] = [];
      const unsub = onLocaleChange(l => calls.push(l));
      setLocale("en-US");
      setLocale("zh-CN");
      // 监听器被调用一次（en-US → zh-CN 中间状态可能合并）
      expect(calls.length).toBeGreaterThanOrEqual(1);
      unsub();
    });

    it("取消订阅后不再触发", () => {
      const calls: Locale[] = [];
      const unsub = onLocaleChange(l => calls.push(l));
      unsub();
      setLocale("en-US");
      setLocale("zh-CN");
      expect(calls.length).toBe(0);
    });
  });

  describe("t", () => {
    beforeEach(() => {
      setLocale("zh-CN");
    });

    it("中文查找 key", () => {
      expect(t("common.save")).toBe("保存");
      expect(t("common.cancel")).toBe("取消");
      expect(t("settings.title")).toBe("设置");
    });

    it("插值变量", () => {
      const result = t("chat.usagePercentage", { percentage: 50 });
      expect(result).toBe("上下文: 50%");
    });

    it("嵌套 key 查找", () => {
      expect(t("history.relativeTime.today")).toBe("今天");
      expect(t("usage.overview")).toBe("总览");
    });

    it("缺失 key 返回 key 本身", () => {
      expect(t("nonexistent.key")).toBe("nonexistent.key");
      expect(t("common.nonexistent")).toBe("common.nonexistent");
    });

    it("英文 fallback", () => {
      setLocale("en-US");
      expect(t("common.save")).toBe("Save");
      expect(t("chat.elapsedTime", { time: "5 sec" })).toBe("Elapsed 5 sec");
    });
  });
});
