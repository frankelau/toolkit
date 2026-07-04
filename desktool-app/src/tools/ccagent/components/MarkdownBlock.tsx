// MarkdownBlock.tsx — 完整 Markdown 渲染组件
// 对齐 cc-gui MarkdownBlock (912行): 语法高亮 + Mermaid + 流式安全 + XSS 防护
//
// 与旧版差异:
//  - 旧版: 62行, dangerouslySetInnerHTML + 简单 renderMd
//  - 新版: 400+行, marked-highlight + DOMPurify hooks + mermaid lazy-load + 流式渲染

import { memo, useMemo, useState, useRef, useEffect, useCallback } from "react";
import {
  renderMarkdownFull, renderStreamingContent, hasPossibleMermaidContent,
  isMermaidKeyword, configureMarked,
} from "../utils";
import { copyToClipboard } from "../utils";

// ─── Mermaid 懒加载 ──────────────────────────────────────────────────────────
let mermaidInstance: typeof import("mermaid").default | null = null;
let mermaidIdCounter = 0;
const MERMAID_MAX_RETRIES = 3;

async function getMermaid() {
  if (!mermaidInstance) {
    const mod = await import("mermaid");
    mermaidInstance = mod.default;
    mermaidInstance.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "strict",
      fontFamily: "inherit",
    });
  }
  return mermaidInstance;
}

// ─── Copy icon ───────────────────────────────────────────────────────────────
const copyIconSvg = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 4l0 8a2 2 0 0 0 2 2l8 0a2 2 0 0 0 2 -2l0 -8a2 2 0 0 0 -2 -2l-8 0a2 2 0 0 0 -2 2zm2 0l8 0l0 8l-8 0l0 -8z" fill="currentColor" fill-opacity="0.9"/>
  <path d="M2 2l0 8l-2 0l0 -8a2 2 0 0 1 2 -2l8 0l0 2l-8 0z" fill="currentColor" fill-opacity="0.6"/>
</svg>`;

// ─── Props ───────────────────────────────────────────────────────────────────
export interface MarkdownBlockProps {
  content?: string;
  isStreaming?: boolean;
  className?: string;
  enableCopy?: boolean;
}

// ─── 组件 ────────────────────────────────────────────────────────────────────
const MarkdownBlock = ({
  content = "",
  isStreaming = false,
  className = "",
  enableCopy = true,
}: MarkdownBlockProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevIsStreamingRef = useRef(isStreaming);
  const mermaidRetryRef = useRef(0);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  // 初始化 marked 配置（仅首次）
  useEffect(() => { configureMarked(); }, []);

  // ─── Mermaid 渲染 ─────────────────────────────────────────────────────
  const renderMermaidDiagrams = useCallback(async () => {
    if (!containerRef.current) return;
    const codeBlocks = containerRef.current.querySelectorAll("pre code");
    if (codeBlocks.length === 0) { mermaidRetryRef.current = 0; return; }

    let renderedAny = false;
    for (const codeBlock of codeBlocks) {
      const pre = codeBlock.parentElement;
      if (!pre) continue;
      const wrapper = pre.parentElement;
      if (wrapper?.classList.contains("mermaid-rendered")) continue;

      let code = (codeBlock.textContent || "").replace(/^```mermaid\s*/i, "").replace(/```\s*$/, "").trim();
      if (!code) continue;

      const firstWord = code.split(/[\s\n]/)[0].toLowerCase();
      if (!isMermaidKeyword(firstWord)) continue;

      // Loading placeholder
      const loadingEl = document.createElement("div");
      loadingEl.className = "mermaid-loading";
      loadingEl.textContent = "Loading diagram\u2026";
      loadingEl.style.cssText = "padding:12px;color:var(--text-secondary,#888);";
      if (wrapper?.classList.contains("code-block-wrapper")) {
        wrapper.insertBefore(loadingEl, pre);
      } else {
        pre.parentNode?.insertBefore(loadingEl, pre);
      }

      try {
        const mmd = await getMermaid();
        const id = `mermaid-${++mermaidIdCounter}`;
        const { svg } = await mmd.render(id, code);
        const mermaidContainer = document.createElement("div");
        mermaidContainer.className = "mermaid-diagram";
        mermaidContainer.innerHTML = svg;
        loadingEl.remove();

        if (wrapper?.classList.contains("code-block-wrapper")) {
          wrapper.classList.add("mermaid-rendered");
          pre.style.display = "none";
          wrapper.insertBefore(mermaidContainer, pre);
        } else {
          const newWrapper = document.createElement("div");
          newWrapper.className = "code-block-wrapper mermaid-rendered";
          newWrapper.appendChild(mermaidContainer);
          pre.parentNode?.replaceChild(newWrapper, pre);
        }
        renderedAny = true;
      } catch {
        loadingEl.remove();
      }
    }

    if (renderedAny) mermaidRetryRef.current = 0;
    return renderedAny;
  }, []);

  // 非流式时渲染 Mermaid
  useEffect(() => {
    if (isStreaming) return;
    if (!hasPossibleMermaidContent(content)) { mermaidRetryRef.current = 0; return; }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let rafId: number | null = null;
    let done = false;

    const tryRender = () => {
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(() => {
          renderMermaidDiagrams().then((rendered) => {
            if (!rendered && !done && mermaidRetryRef.current < MERMAID_MAX_RETRIES) {
              mermaidRetryRef.current++;
              timeoutId = setTimeout(() => {
                if (!done) requestAnimationFrame(() => renderMermaidDiagrams());
              }, 100 * mermaidRetryRef.current);
            }
          });
        });
      });
    };
    tryRender();

    return () => {
      done = true;
      cancelAnimationFrame(rafId!);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [content, isStreaming, renderMermaidDiagrams]);

  // ─── HTML 生成 ─────────────────────────────────────────────────────────
  const html = useMemo(() => {
    if (isStreaming) {
      return renderStreamingContent(content);
    }
    return renderMarkdownFull(content);
  }, [content, isStreaming]);

  // ─── 流式结束 → 强制完整重渲染 ───────────────────────────────────────────
  useEffect(() => {
    if (prevIsStreamingRef.current && !isStreaming && containerRef.current) {
      let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
      let done = false;

      const applyRefresh = () => {
        if (done || !containerRef.current) return;
        done = true;
        containerRef.current.innerHTML = html;
        renderMermaidDiagrams();
      };

      const rafId1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          applyRefresh();
          fallbackTimer = setTimeout(applyRefresh, 100);
        });
      });

      prevIsStreamingRef.current = isStreaming;
      return () => {
        done = true;
        cancelAnimationFrame(rafId1);
        if (fallbackTimer) clearTimeout(fallbackTimer);
      };
    }
    prevIsStreamingRef.current = isStreaming;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, html, renderMermaidDiagrams]);

  // ─── 代码复制按钮注入 ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !enableCopy) return;
    const pres = containerRef.current.querySelectorAll("pre");

    pres.forEach((pre) => {
      const parent = pre.parentElement;
      if (parent?.classList.contains("code-block-wrapper")) return;

      const wrapper = document.createElement("div");
      wrapper.className = "code-block-wrapper";
      pre.parentNode?.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copy-code-btn";
      btn.title = "复制代码";

      const iconSpan = document.createElement("span");
      iconSpan.className = "copy-icon";
      iconSpan.innerHTML = copyIconSvg;

      const tooltipSpan = document.createElement("span");
      tooltipSpan.className = "copy-tooltip";
      tooltipSpan.textContent = "已复制!";

      btn.appendChild(iconSpan);
      btn.appendChild(tooltipSpan);
      wrapper.appendChild(btn);
    });
  }, [html, enableCopy]);

  // ─── 点击处理 ───────────────────────────────────────────────────────────
  const handleClick = useCallback(async (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const copyBtn = target.closest("button.copy-code-btn") as HTMLButtonElement | null;

    if (copyBtn && containerRef.current?.contains(copyBtn)) {
      event.preventDefault();
      event.stopPropagation();
      const wrapper = copyBtn.closest(".code-block-wrapper");
      const codeEl = wrapper?.querySelector("pre code") as HTMLElement | null;
      const text = codeEl?.innerText || codeEl?.textContent || "";
      const ok = await copyToClipboard(text);
      if (ok) {
        copyBtn.classList.add("copied");
        setTimeout(() => copyBtn.classList.remove("copied"), 1500);
      }
      return;
    }

    // 图片预览
    const img = target.closest("img");
    if (img?.getAttribute("src")) {
      setPreviewSrc(img.getAttribute("src"));
      return;
    }

    // 链接：在新窗口打开
    const anchor = target.closest("a");
    if (anchor) {
      const href = anchor.getAttribute("href");
      if (href && /^https?:\/\//.test(href)) {
        event.preventDefault();
        window.open(href, "_blank");
      }
    }
  }, [copyToClipboard]);

  return (
    <>
      <div
        ref={containerRef}
        className={`markdown-content ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={handleClick}
      />
      {previewSrc && (
        <div
          className="image-preview-overlay"
          onClick={() => setPreviewSrc(null)}
          onKeyDown={(e) => e.key === "Escape" && setPreviewSrc(null)}
          tabIndex={0}
        >
          <img className="image-preview-content" src={previewSrc} alt="" onClick={(e) => e.stopPropagation()} />
          <button className="image-preview-close" onClick={() => setPreviewSrc(null)}>×</button>
        </div>
      )}
    </>
  );
};

export default memo(MarkdownBlock);
