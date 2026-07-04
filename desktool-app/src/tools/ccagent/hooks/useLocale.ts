// useLocale.ts — i18n React 适配 hook
// Sprint Final F3: 让组件响应语言切换并获取 t 函数
//
// 用法：
//   const { t, locale, setLocale } = useLocale();
//   <button>{t("common.save")}</button>
//
// 原理：订阅 i18n 的 onLocaleChange，语言切换时触发组件重渲染。

import { useSyncExternalStore, useCallback } from "react";
import { getLocale, setLocale as setLocaleFn, onLocaleChange, t as tFn, type Locale } from "../i18n";

/** i18n 适配 hook — 返回当前语言 + t 函数 + setLocale */
export function useLocale() {
  // 订阅语言变化，语言切换时触发重渲染
  const locale = useSyncExternalStore(
    (onChange) => onLocaleChange(() => onChange()),
    () => getLocale(),
    () => getLocale(),
  );

  const setLocale = useCallback((next: Locale) => setLocaleFn(next), []);

  return { locale, setLocale, t: tFn };
}
