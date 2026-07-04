import React from "react";
import ReactDOM from "react-dom/client";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";

// 拦截所有外部链接，用系统浏览器打开，防止 webview 导航离开应用
document.addEventListener("click", (e) => {
  const a = (e.target as Element).closest("a");
  if (!a) return;
  const href = a.getAttribute("href");
  if (!href || (!href.startsWith("http://") && !href.startsWith("https://"))) return;
  e.preventDefault();
  openUrl(href);
}, true);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// 内容渲染完成后再显示窗口，消除白屏闪烁
requestAnimationFrame(() => {
  invoke("show_main_window").catch(() => {});
});
