// useThemeInit — 主题初始化
// 对齐 cc-gui useThemeInit

import { useEffect } from "react";

type Theme = "light" | "dark" | "auto";

export function useThemeInit(initialTheme: Theme = "auto") {
  useEffect(() => {
    const apply = (t: Theme) => {
      const root = document.documentElement;
      if (t === "auto") {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.setAttribute("data-theme", prefersDark ? "dark" : "light");
      } else {
        root.setAttribute("data-theme", t);
      }
    };
    apply(initialTheme);

    if (initialTheme === "auto") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply("auto");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [initialTheme]);
}
