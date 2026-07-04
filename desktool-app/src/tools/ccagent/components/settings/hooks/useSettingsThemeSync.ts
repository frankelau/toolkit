// useSettingsThemeSync — 设置主题同步
// 对齐 cc-gui useSettingsThemeSync

import { useEffect } from "react";

export type Theme = "light" | "dark" | "auto";

export function useSettingsThemeSync(theme: Theme) {
  useEffect(() => {
    const root = document.documentElement;
    const apply = (t: Theme) => {
      if (t === "auto") {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.setAttribute("data-theme", prefersDark ? "dark" : "light");
      } else {
        root.setAttribute("data-theme", t);
      }
    };
    apply(theme);

    if (theme === "auto") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply("auto");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);
}
