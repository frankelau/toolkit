// CollapsibleTextBlock — 超长文本自动折叠，点击展开
// 对齐 cc-gui CollapsibleTextBlock

import { useState, useRef, useEffect } from "react";

export interface CollapsibleTextBlockProps {
  content: string;
  /** 折叠时最大高度（px），默认 160 */
  maxHeight?: number;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 显示标题 */
  title?: string;
  /** 是否是代码块（用 mono 字体） */
  mono?: boolean;
}

export function CollapsibleTextBlock(props: CollapsibleTextBlockProps) {
  const { content, maxHeight = 160, defaultExpanded = false, title, mono = false } = props;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;
    const check = () => {
      if (contentRef.current) {
        setIsOverflowing(contentRef.current.scrollHeight > maxHeight);
      }
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [content, maxHeight]);

  const contentStyle: React.CSSProperties = {
    maxHeight: expanded || !isOverflowing ? "none" : `${maxHeight}px`,
    overflow: "hidden",
    fontFamily: mono ? "var(--mono, monospace)" : "inherit",
  };

  return (
    <div className={`cc-collapsible ${expanded ? "expanded" : "collapsed"}`}>
      {title && <div className="cc-collapsible-title">{title}</div>}
      <div ref={contentRef} className="cc-collapsible-content" style={contentStyle}>
        <pre>{content}</pre>
      </div>
      {isOverflowing && (
        <button
          className="cc-collapsible-toggle"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        >
          {expanded ? "▲ 收起" : "▼ 展开"}
        </button>
      )}
    </div>
  );
}
