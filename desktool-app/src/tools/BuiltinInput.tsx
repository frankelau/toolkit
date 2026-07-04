import { useEffect, useRef, useState } from "react";
import { BUILTIN_FNS } from "./builtins";
import "./BuiltinInput.css";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onBlur?: () => void;
}

/**
 * 输入框/文本域，输入 {{ 时弹出内置函数提示列表，点击或 Enter 插入。
 */
export default function BuiltinInput({
  value, onChange, placeholder, multiline, className, onKeyDown, onBlur,
}: Props) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const [show, setShow] = useState(false);
  const [filter, setFilter] = useState("");
  const [idx, setIdx] = useState(0);

  const suggestions = BUILTIN_FNS.filter(
    (f) => !filter || f.name.startsWith(filter.toLowerCase()),
  );

  // 每次 value 变化后检测光标前是否有 "{{$..." 前缀
  function checkTrigger(el: HTMLInputElement | HTMLTextAreaElement) {
    const pos = el.selectionStart ?? 0;
    const before = el.value.slice(0, pos);
    const m = /\{\{\$([a-zA-Z]*)$/.exec(before);
    if (m) {
      setFilter(m[1]);
      setShow(true);
      setIdx(0);
    } else {
      setShow(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    onChange(e.target.value);
    checkTrigger(e.target);
  }

  function insert(syntax: string) {
    const el = ref.current;
    if (!el) return;
    const pos = el.selectionStart ?? 0;
    const before = el.value.slice(0, pos);
    const after = el.value.slice(pos);
    // 替换掉已输入的 "{{$..." 前缀
    const prefix = before.replace(/\{\{\$[a-zA-Z]*$/, "");
    const next = prefix + syntax + after;
    onChange(next);
    setShow(false);
    // 把光标移到插入内容末尾
    requestAnimationFrame(() => {
      const newPos = prefix.length + syntax.length;
      el.focus();
      el.setSelectionRange(newPos, newPos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (show && suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insert(suggestions[idx].syntax);
        return;
      }
      if (e.key === "Escape") { setShow(false); return; }
    }
    onKeyDown?.(e);
  }

  // 点击外部关闭
  useEffect(() => {
    if (!show) return;
    const hide = () => setShow(false);
    window.addEventListener("mousedown", hide);
    return () => window.removeEventListener("mousedown", hide);
  }, [show]);

  const sharedProps = {
    ref,
    value,
    placeholder,
    className: `bi-field ${className ?? ""}`,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onBlur,
    spellCheck: false as const,
  };

  return (
    <div className="bi-wrap">
      {multiline
        ? <textarea {...sharedProps} />
        : <input {...sharedProps} />
      }
      {show && suggestions.length > 0 && (
        <ul className="bi-list" onMouseDown={(e) => e.preventDefault()}>
          {suggestions.map((f, i) => (
            <li
              key={f.name}
              className={i === idx ? "on" : ""}
              onClick={() => insert(f.syntax)}
              onMouseEnter={() => setIdx(i)}
            >
              <div className="bi-row-main">
                <span className="bi-syntax">{f.syntax}</span>
                <span className="bi-desc">{f.desc}</span>
              </div>
              <div className="bi-row-eg">
                <span className="bi-eg-label">示例：</span>
                <span className="bi-eg-val">{f.example}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
