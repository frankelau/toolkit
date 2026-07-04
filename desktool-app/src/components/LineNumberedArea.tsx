import { useCallback, useMemo, useRef, useState } from "react";
import "./LineNumberedArea.css";

interface Props {
  value: string;
  onChange?: (next: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  /** 透传到外层 .lna 容器，便于各工具控制尺寸 */
  className?: string;
  /** 透传到外层 .lna 容器（如可拖拽高度） */
  style?: React.CSSProperties;
  spellCheck?: boolean;
}

/**
 * 轻量带行号 + 状态栏的文本编辑区（无查找替换/撤销栈）。
 * 用于各工具的多行编辑区，统一展示：左侧行号栏、底部状态栏
 * （字符数 / 行数 / 选中字符数 / 光标行列）。
 * 行号栏字号用 em，跟随外层 font-size 缩放，保证逐行对齐。
 * 行号模式下关闭自动换行（white-space: pre），否则长行折行会与行号错位。
 */
export default function LineNumberedArea({
  value,
  onChange,
  placeholder,
  readOnly,
  className,
  style,
  spellCheck = false,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const [sel, setSel] = useState({ start: 0, end: 0 });
  const updateSel = useCallback(() => {
    const ta = taRef.current;
    if (ta) setSel({ start: ta.selectionStart, end: ta.selectionEnd });
  }, []);

  const syncScroll = useCallback(() => {
    const ta = taRef.current;
    if (ta && gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  }, []);

  const lineCount = useMemo(
    () => (value === "" ? 1 : value.split("\n").length),
    [value],
  );
  const cursor = useMemo(() => {
    const before = value.slice(0, sel.end);
    const line = before.split("\n").length;
    const col = sel.end - before.lastIndexOf("\n");
    return { line, col };
  }, [value, sel.end]);
  const selectedCount = Math.abs(sel.end - sel.start);

  return (
    <div className={`lna ${className ?? ""}`} style={style}>
      <div className="lna-editor">
        <div className="lna-gutter" ref={gutterRef} aria-hidden>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="lna-gutter-num">
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={taRef}
          className="lna-input"
          value={value}
          onChange={(e) => {
            onChange?.(e.target.value);
            updateSel();
          }}
          onScroll={syncScroll}
          onSelect={updateSel}
          onKeyUp={updateSel}
          onClick={updateSel}
          onFocus={updateSel}
          placeholder={placeholder}
          readOnly={readOnly}
          spellCheck={spellCheck}
        />
      </div>
      <div className="lna-statusbar">
        <span>{value.length} 字符</span>
        <span>{lineCount} 行</span>
        {selectedCount > 0 && (
          <span className="lna-status-sel">已选 {selectedCount} 字符</span>
        )}
        <span className="lna-status-spacer" />
        <span>
          行 {cursor.line}，列 {cursor.col}
        </span>
      </div>
    </div>
  );
}
