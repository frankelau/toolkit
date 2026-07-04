import { useCallback, useRef } from "react";
import type { LineTag } from "../tools/lineCompare";
import "./DiffTextarea.css";

interface Props {
  value: string;
  onChange: (v: string) => void;
  tags: LineTag[];
  placeholder?: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHtml(value: string, tags: LineTag[]): string {
  const lines = value.split("\n");
  return (
    lines
      .map((ln, i) => {
        const tag = tags[i] ?? "same";
        const cls = tag === "same" ? "" : `dl ${tag}`;
        return `<div class="${cls}">${esc(ln) || " "}</div>`;
      })
      .join("") || "<div> </div>"
  );
}

/**
 * 可编辑文本框 + 行级差异高亮背景。
 * 透明 textarea 叠在高亮 backdrop 上，滚动同步。
 * 标签：added 绿 / diff 红 / gap 斜纹占位。
 */
export default function DiffTextarea({ value, onChange, tags, placeholder }: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const bdRef = useRef<HTMLDivElement>(null);

  const sync = useCallback(() => {
    const ta = taRef.current;
    const bd = bdRef.current;
    if (ta && bd) {
      bd.scrollTop = ta.scrollTop;
      bd.scrollLeft = ta.scrollLeft;
    }
  }, []);

  return (
    <div className="dta">
      <div
        className="dta-backdrop"
        ref={bdRef}
        aria-hidden
        dangerouslySetInnerHTML={{ __html: buildHtml(value, tags) }}
      />
      <textarea
        ref={taRef}
        className="dta-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={sync}
        placeholder={placeholder}
        spellCheck={false}
      />
    </div>
  );
}
