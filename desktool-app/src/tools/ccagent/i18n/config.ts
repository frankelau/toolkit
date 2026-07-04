// i18n/config.ts — i18n 初始化（轻量自实现，无 i18next 依赖）
// Sprint M: 对齐 cc-gui 的 i18n/config.ts
// 提供多语言文案查找 + 语言切换 + 插值支持

import zhCN from "./locales/zh-CN.json";
import enUS from "./locales/en-US.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import zhTW from "./locales/zh-TW.json";

export type Locale = "zh-CN" | "en-US" | "ja" | "ko" | "zh-TW";

/** 语言资源 */
const RESOURCES: Record<Locale, Record<string, unknown>> = {
  "zh-CN": zhCN,
  "en-US": enUS,
  "ja": ja,
  "ko": ko,
  "zh-TW": zhTW,
};

const STORAGE_KEY = "ccagent:locale";

/** 所有支持的语言列表 */
export const SUPPORTED_LOCALES: Locale[] = ["zh-CN", "en-US", "ja", "ko", "zh-TW"];

/** 语言标签映射 */
export const LOCALE_LABELS: Record<Locale, string> = {
  "zh-CN": "简体中文",
  "en-US": "English",
  "ja": "日本語",
  "ko": "한국어",
  "zh-TW": "繁體中文",
};

/** 默认语言 */
const DEFAULT_LOCALE: Locale = "zh-CN";

/** 获取初始语言（localStorage > 浏览器语言 > 默认） */
function getInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LOCALES.includes(saved as Locale)) return saved as Locale;
  } catch { /* ignore */ }
  // 浏览器语言检测
  const nav = navigator.language?.toLowerCase() || "";
  if (nav.startsWith("zh") && nav.includes("tw") || nav.includes("hk")) return "zh-TW";
  if (nav.startsWith("zh")) return "zh-CN";
  if (nav.startsWith("ja")) return "ja";
  if (nav.startsWith("ko")) return "ko";
  return "en-US";
}

/** 当前语言 */
let currentLocale: Locale = getInitialLocale();

/** 语言变化监听器 */
const listeners: Set<(locale: Locale) => void> = new Set();

/** 简易监听器订阅 */
export function onLocaleChange(fn: (locale: Locale) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 获取当前语言 */
export function getLocale(): Locale {
  return currentLocale;
}

/** 设置当前语言（同步 localStorage + 触发监听器） */
export function setLocale(locale: Locale): void {
  if (locale === currentLocale) return;
  currentLocale = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch { /* ignore */ }
  for (const fn of listeners) {
    try { fn(locale); } catch { /* ignore */ }
  }
}

/** 按点分路径查找 key（如 "common.save"） */
function lookup(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

/** 插值替换：{{name}} → vars.name */
function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
    k in vars ? String(vars[k]) : `{{${k}}}`,
  );
}

/** 翻译函数 */
export function t(key: string, vars?: Record<string, string | number>): string {
  // 优先当前语言
  let text = lookup(RESOURCES[currentLocale], key);
  // 回退到默认语言
  if (text === undefined) {
    text = lookup(RESOURCES[DEFAULT_LOCALE], key);
  }
  // 仍找不到，返回 key 本身（便于调试缺失）
  if (text === undefined) return key;
  return interpolate(text, vars);
}

/** 批量翻译（用于组件 props 一次取多个 key） */
export function tAll(keys: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, key] of Object.entries(keys)) {
    result[name] = t(key);
  }
  return result;
}

export default {
  getLocale,
  setLocale,
  onLocaleChange,
  t,
  tAll,
};
