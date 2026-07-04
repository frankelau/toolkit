// ChangelogDialog — 更新日志弹窗
// 对齐 cc-gui 的 ChangelogDialog.tsx
// 分页展示版本日志，支持键盘左右翻页、Esc 关闭

import { useCallback, useEffect, useState } from "react";
import type { ChangelogEntry } from "../types";
import { CloseIcon, ChevronLeftIcon, ChevronRightIcon } from "./Icons";

interface ChangelogDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entries: ChangelogEntry[];
  initialPage?: number;
}

/** 解析日志内容，中英文同时存在时都展示 */
function resolveContent(entry: ChangelogEntry): string[] {
  const { en, zh } = entry.content;
  const parts: string[] = [];
  if (en) parts.push(en);
  if (zh) parts.push(zh);
  return parts;
}

/** 简易 markdown 渲染（标题/列表/行内代码） */
function renderChangelogMarkdown(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  const htmlParts: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) { htmlParts.push("</ul>"); inList = false; }
      continue;
    }
    // 列表项
    if (trimmed.startsWith("- ")) {
      if (!inList) { htmlParts.push("<ul>"); inList = true; }
      const itemText = escapeHtml(trimmed.substring(2)).replace(/`([^`]+)`/g, "<code>$1</code>");
      htmlParts.push(`<li>${itemText}</li>`);
      continue;
    }
    if (inList) { htmlParts.push("</ul>"); inList = false; }
    // 带 emoji 的章节标题
    if (/^[✨🐛🔧🎉🚀💡⚡️🔥📦🛠️]/.test(trimmed)) {
      htmlParts.push(`<h4>${escapeHtml(trimmed)}</h4>`);
      continue;
    }
    // P0/P1/P2 优先级标签
    if (/^P\d/.test(trimmed)) {
      if (!inList) { htmlParts.push("<ul>"); inList = true; }
      htmlParts.push(`<li>${escapeHtml(trimmed)}</li>`);
      continue;
    }
    htmlParts.push(`<p>${escapeHtml(trimmed)}</p>`);
  }
  if (inList) htmlParts.push("</ul>");
  return htmlParts.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function ChangelogDialog({
  isOpen,
  onClose,
  entries,
  initialPage = 0,
}: ChangelogDialogProps) {
  const [currentPage, setCurrentPage] = useState(initialPage);

  // 打开时重置页码
  useEffect(() => {
    if (isOpen) setCurrentPage(initialPage);
  }, [isOpen, initialPage]);

  // 键盘导航
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        setCurrentPage(prev => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight") {
        setCurrentPage(prev => Math.min(entries.length - 1, prev + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, entries.length, onClose]);

  const handlePrev = useCallback(() => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentPage(prev => Math.min(entries.length - 1, prev + 1));
  }, [entries.length]);

  if (!isOpen || entries.length === 0) return null;

  const entry = entries[currentPage];
  const contentParts = resolveContent(entry);
  const totalPages = entries.length;
  const hasPrev = currentPage > 0;
  const hasNext = currentPage < totalPages - 1;

  return (
    <div className="cc-changelog-overlay">
      <div className="cc-changelog-dialog">
        {/* 头部 */}
        <div className="cc-changelog-header">
          <div className="cc-changelog-title-area">
            <h3>更新日志</h3>
            <span className="cc-changelog-version-badge">v{entry.version}</span>
            <span className="cc-changelog-date">{entry.date}</span>
          </div>
          <button className="cc-changelog-close-btn" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </div>

        {/* 内容 */}
        <div className="cc-changelog-body">
          {contentParts.map((part, idx) => (
            <div key={idx}>
              {idx > 0 && <hr className="cc-changelog-divider" />}
              <div
                className="cc-changelog-content"
                dangerouslySetInnerHTML={{ __html: renderChangelogMarkdown(part) }}
              />
            </div>
          ))}
        </div>

        {/* 分页 */}
        <div className="cc-changelog-footer">
          <button
            className="cc-changelog-nav-btn"
            onClick={handlePrev}
            disabled={!hasPrev}
            aria-label="上一个版本"
          >
            <ChevronLeftIcon size={16} />
          </button>

          <div className="cc-changelog-pagination">
            {totalPages <= 10 ? (
              <div className="cc-changelog-dots">
                {entries.map((_, idx) => (
                  <button
                    key={idx}
                    className={`cc-changelog-dot ${idx === currentPage ? "active" : ""}`}
                    onClick={() => setCurrentPage(idx)}
                    aria-label={`第 ${idx + 1} 页`}
                  />
                ))}
              </div>
            ) : (
              <span className="cc-changelog-page-text">
                第 {currentPage + 1} / {totalPages} 页
              </span>
            )}
          </div>

          <button
            className="cc-changelog-nav-btn"
            onClick={handleNext}
            disabled={!hasNext}
            aria-label="下一个版本"
          >
            <ChevronRightIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
