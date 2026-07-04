import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildHighlightHtml,
  buildRegex,
  findMatches,
  flipCase,
  unescapeReplacement,
  escapeHtml,
  type SearchOptions,
} from "./searchEngine";
import "./SearchableTextarea.css";

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  /** 是否默认展开查找栏（独立查找工具用） */
  defaultOpen?: boolean;
  /** 是否默认展开替换行 */
  defaultShowReplace?: boolean;
  /** 显示左侧行号栏 + 底部状态栏（字符数/选中数/光标行列）。适合多行编辑区。 */
  showLineNumbers?: boolean;
  /** 查找替换面板停靠在编辑区上方（不浮动），适合查找替换作为主功能的工具。 */
  dockPanel?: boolean;
}

const COALESCE_MS = 600; // 连续打字在此间隔内合并为一个撤销步骤
const HISTORY_LIMIT = 200;

/**
 * 带 IDEA 风格查找替换的文本编辑区。
 * 结构：高亮层(backdrop) + 透明 textarea 叠加，滚动同步。
 * 自建撤销栈：因 textarea 受控、程序化替换会破坏原生 Cmd+Z。
 * 快捷键：Cmd/Ctrl+F 查找，Cmd/Ctrl+R 替换，Cmd/Ctrl+Z 撤销，
 * Cmd/Ctrl+Shift+Z 或 Cmd/Ctrl+Y 重做，Esc 关闭。
 */
export default function SearchableTextarea({
  value,
  onChange,
  placeholder,
  readOnly,
  className,
  defaultOpen = false,
  defaultShowReplace = false,
  showLineNumbers = false,
  dockPanel = false,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(defaultOpen);
  const [showReplace, setShowReplace] = useState(defaultShowReplace);
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [flipCaseMode, setFlipCaseMode] = useState(false);
  const [opts, setOpts] = useState<SearchOptions>({
    useRegex: false,
    caseSensitive: false,
    wholeWord: false,
  });
  const [current, setCurrent] = useState(0);

  // ---- 光标/选区状态（行号+状态栏用） ----
  const [sel, setSel] = useState({ start: 0, end: 0 });
  const updateSel = useCallback(() => {
    const ta = taRef.current;
    if (ta) setSel({ start: ta.selectionStart, end: ta.selectionEnd });
  }, []);

  // ---- 撤销/重做历史 ----
  const undoRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);
  const lastTypeAtRef = useRef(0);
  const lastDiscreteRef = useRef(true); // 上一次变更是否为离散步骤（打字之外）
  // 优化：仅在 undo/redo 可用性变化时触发重渲染，而非每次击键
  const [, forceRender] = useState(0);
  const canUndoRef = useRef(false);
  const canRedoRef = useRef(false);
  const updateButtons = useCallback(() => {
    const cu = undoRef.current.length > 0;
    const cr = redoRef.current.length > 0;
    if (cu !== canUndoRef.current || cr !== canRedoRef.current) {
      canUndoRef.current = cu;
      canRedoRef.current = cr;
      forceRender((n) => n + 1);
    }
  }, []);

  /** 记录一次离散变更（替换/插入），始终作为独立撤销点 */
  const applyDiscrete = useCallback(
    (next: string) => {
      if (next === value) return;
      undoRef.current.push(value);
      if (undoRef.current.length > HISTORY_LIMIT) undoRef.current.shift();
      redoRef.current = [];
      lastDiscreteRef.current = true;
      onChange(next);
      updateButtons();
    },
    [value, onChange, updateButtons],
  );

  /** 打字变更，按时间间隔合并为一个撤销步骤 */
  const handleType = useCallback(
    (next: string) => {
      const now = Date.now();
      const startNewGroup =
        lastDiscreteRef.current || now - lastTypeAtRef.current > COALESCE_MS;
      if (startNewGroup) {
        undoRef.current.push(value);
        if (undoRef.current.length > HISTORY_LIMIT) undoRef.current.shift();
        redoRef.current = [];
      }
      lastTypeAtRef.current = now;
      lastDiscreteRef.current = false;
      onChange(next);
      updateButtons();
    },
    [value, onChange, updateButtons],
  );

  const undo = useCallback(() => {
    if (undoRef.current.length === 0) return;
    const prev = undoRef.current.pop()!;
    redoRef.current.push(value);
    lastDiscreteRef.current = true;
    onChange(prev);
    updateButtons();
  }, [value, onChange, updateButtons]);

  const redo = useCallback(() => {
    if (redoRef.current.length === 0) return;
    const next = redoRef.current.pop()!;
    undoRef.current.push(value);
    lastDiscreteRef.current = true;
    onChange(next);
    updateButtons();
  }, [value, onChange, updateButtons]);

  const { regex, error } = useMemo(() => buildRegex(find, opts), [find, opts]);
  const matches = useMemo(() => findMatches(value, regex), [value, regex]);

  // 匹配集合变化时，把 current 收敛到合法范围
  useEffect(() => {
    if (matches.length === 0) setCurrent(0);
    else if (current >= matches.length) setCurrent(0);
  }, [matches.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const highlightHtml = useMemo(
    // 优化：查找面板关闭时跳过高亮计算（大文本场景下节省大量 CPU）
    () => (open && matches.length > 0 ? buildHighlightHtml(value, matches, current) : escapeHtml(value) + "\n"),
    [value, matches, current, open],
  );

  // 滚动同步：textarea -> backdrop（+ 行号栏垂直同步）
  const syncScroll = useCallback(() => {
    const ta = taRef.current;
    const bd = backdropRef.current;
    if (ta && bd) {
      bd.scrollTop = ta.scrollTop;
      bd.scrollLeft = ta.scrollLeft;
    }
    if (ta && gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop;
    }
  }, []);

  // ---- 行号 + 状态栏派生值 ----
  // 优化：对于大文本（>50KB），延迟行号计算到空闲帧，避免阻塞输入
  const lineCount = useMemo(
    () => (value === "" ? 1 : value.split("\n").length),
    [value],
  );
  // 光标行列（1-based）。取选区末端作为光标位置。
  const cursor = useMemo(() => {
    const before = value.slice(0, sel.end);
    const line = before.split("\n").length;
    const col = sel.end - before.lastIndexOf("\n");
    return { line, col };
  }, [value, sel.end]);
  const selectedCount = Math.abs(sel.end - sel.start);

  /** 选中并滚动到第 idx 个匹配 */
  const focusMatch = useCallback(
    (idx: number) => {
      const ta = taRef.current;
      const mt = matches[idx];
      if (!ta || !mt) return;
      ta.focus();
      ta.setSelectionRange(mt.start, mt.end);
      requestAnimationFrame(syncScroll);
    },
    [matches, syncScroll],
  );

  function go(delta: number) {
    if (matches.length === 0) return;
    const next = (current + delta + matches.length) % matches.length;
    setCurrent(next);
    focusMatch(next);
  }

  function replaceCurrent() {
    const mt = matches[current];
    if (!mt) return;
    const matched = value.slice(mt.start, mt.end);
    const rep = flipCaseMode ? flipCase(matched) : unescapeReplacement(replace);
    applyDiscrete(value.slice(0, mt.start) + rep + value.slice(mt.end));
  }

  function replaceAll() {
    if (!regex) return;
    if (flipCaseMode) {
      applyDiscrete(value.replace(regex, (m) => flipCase(m)));
    } else {
      const rep = unescapeReplacement(replace);
      // 用函数形式避免 rep 中的 $ 被当作替换模式
      applyDiscrete(value.replace(regex, () => rep));
    }
  }

  /** 在替换框光标处插入转义序列（如 \n、\t） */
  function insertEscape(seq: string) {
    const el = replaceInputRef.current;
    if (!el) {
      setReplace((r) => r + seq);
      return;
    }
    const s = el.selectionStart ?? replace.length;
    const e = el.selectionEnd ?? replace.length;
    const next = replace.slice(0, s) + seq + replace.slice(e);
    setReplace(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + seq.length, s + seq.length);
    });
  }

  // 快捷键
  function onKeyDown(e: React.KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    const onTextarea = e.target === taRef.current;
    if (mod && e.key === "f") {
      e.preventDefault();
      setOpen(true);
      setShowReplace(false);
      seedFromSelection();
    } else if (mod && (e.key === "r" || e.key === "h")) {
      e.preventDefault();
      setOpen(true);
      setShowReplace(true);
      seedFromSelection();
    } else if (e.key === "Escape" && open) {
      setOpen(false);
      taRef.current?.focus();
    } else if (mod && (e.key === "z" || e.key === "Z") && !readOnly && onTextarea) {
      // 撤销 / 重做（仅作用于编辑区，避免劫持搜索框内的撤销）
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && (e.key === "y" || e.key === "Y") && !readOnly && onTextarea) {
      e.preventDefault();
      redo();
    }
  }

  /** 打开查找时，若编辑区有选中文本，作为初始查找词 */
  function seedFromSelection() {
    const ta = taRef.current;
    if (!ta) return;
    const sel = value.slice(ta.selectionStart, ta.selectionEnd);
    if (sel && !sel.includes("\n")) setFind(sel);
  }

  const findInputRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (open) findInputRef.current?.focus();
  }, [open, showReplace]);

  const countLabel = find
    ? matches.length
      ? `${current + 1}/${matches.length}`
      : "无结果"
    : "";

  function toggle(key: keyof SearchOptions) {
    setOpts((o) => ({ ...o, [key]: !o[key] }));
  }

  return (
    <div
      className={`sta ${showLineNumbers ? "sta-with-ln" : ""} ${dockPanel ? "sta-docked" : ""} ${className ?? ""}`}
      onKeyDown={onKeyDown}
    >
      {dockPanel && open && (
        <div className="sta-panel sta-panel-docked">
          <div className="sta-row">
            <button
              className="sta-expand"
              title={showReplace ? "收起替换" : "展开替换"}
              onClick={() => setShowReplace((s) => !s)}
            >
              {showReplace ? "▾" : "▸"}
            </button>
            <div className="sta-fieldwrap">
              <input
                ref={findInputRef}
                className="sta-field"
                placeholder="查找"
                value={find}
                onChange={(e) => setFind(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); go(e.shiftKey ? -1 : 1); }
                }}
              />
              <span className={`sta-count ${error ? "err" : ""}`}>{error ? "正则错误" : countLabel}</span>
            </div>
            <button className={`sta-opt ${opts.caseSensitive ? "on" : ""}`} onClick={() => toggle("caseSensitive")}>区分大小写(Aa)</button>
            <button className={`sta-opt ${opts.wholeWord ? "on" : ""}`} onClick={() => toggle("wholeWord")}>全词(W)</button>
            <button className={`sta-opt ${opts.useRegex ? "on" : ""}`} onClick={() => toggle("useRegex")}>正则(.*)</button>
            <button className="sta-nav" onClick={() => go(-1)} disabled={matches.length === 0}>上一个(↑)</button>
            <button className="sta-nav" onClick={() => go(1)} disabled={matches.length === 0}>下一个(↓)</button>
          </div>
          {showReplace && !readOnly && (
            <div className="sta-row">
              <span className="sta-expand" />
              <div className="sta-fieldwrap">
                <input ref={replaceInputRef} className="sta-field" placeholder="替换" value={replace} onChange={(e) => setReplace(e.target.value)} disabled={flipCaseMode} />
              </div>
              <button className="sta-opt" onClick={() => insertEscape("\\n")} disabled={flipCaseMode}>换行(\n)</button>
              <button className="sta-opt" onClick={() => insertEscape("\\t")} disabled={flipCaseMode}>制表(\t)</button>
              <button className={`sta-opt ${flipCaseMode ? "on" : ""}`} onClick={() => setFlipCaseMode((f) => !f)}>翻转大小写(aA)</button>
              <button className="sta-textbtn" onClick={replaceCurrent} disabled={matches.length === 0}>替换</button>
              <button className="sta-textbtn" onClick={replaceAll} disabled={matches.length === 0}>全部替换</button>
            </div>
          )}
        </div>
      )}
      <div className="sta-editor">
        {showLineNumbers && (
          <div className="sta-gutter" ref={gutterRef} aria-hidden>
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} className="sta-gutter-num">
                {i + 1}
              </div>
            ))}
          </div>
        )}
        <div className="sta-textwrap">
          <div
            className="sta-backdrop"
            ref={backdropRef}
            aria-hidden
            dangerouslySetInnerHTML={{ __html: highlightHtml }}
          />
          <textarea
            ref={taRef}
            className="sta-input"
            value={value}
            onChange={(e) => {
              handleType(e.target.value);
              updateSel();
            }}
            onScroll={syncScroll}
            onSelect={updateSel}
            onKeyUp={updateSel}
            onClick={updateSel}
            onFocus={updateSel}
            placeholder={placeholder}
            readOnly={readOnly}
            spellCheck={false}
          />
        </div>
      </div>

      {showLineNumbers && (
        <div className="sta-statusbar">
          <span>{value.length} 字符</span>
          <span>{lineCount} 行</span>
          {selectedCount > 0 && (
            <span className="sta-status-sel">已选 {selectedCount} 字符</span>
          )}
          <span className="sta-status-spacer" />
          <span>
            行 {cursor.line}，列 {cursor.col}
          </span>
        </div>
      )}

      {open && !dockPanel && (
        <div className="sta-panel">
          <div className="sta-row">
            <button
              className="sta-expand"
              title={showReplace ? "收起替换" : "展开替换"}
              onClick={() => setShowReplace((s) => !s)}
            >
              {showReplace ? "▾" : "▸"}
            </button>
            <div className="sta-fieldwrap">
              <input
                ref={findInputRef}
                className="sta-field"
                placeholder="查找"
                value={find}
                onChange={(e) => setFind(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    go(e.shiftKey ? -1 : 1);
                  }
                }}
              />
              <span className={`sta-count ${error ? "err" : ""}`}>
                {error ? "正则错误" : countLabel}
              </span>
            </div>
            <button
              className={`sta-opt ${opts.caseSensitive ? "on" : ""}`}
              title="区分大小写"
              onClick={() => toggle("caseSensitive")}
            >
              区分大小写(Aa)
            </button>
            <button
              className={`sta-opt ${opts.wholeWord ? "on" : ""}`}
              title="全词匹配"
              onClick={() => toggle("wholeWord")}
            >
              全词(W)
            </button>
            <button
              className={`sta-opt ${opts.useRegex ? "on" : ""}`}
              title="正则表达式"
              onClick={() => toggle("useRegex")}
            >
              正则(.*)
            </button>
            <button
              className="sta-nav"
              title="上一个 (Shift+Enter)"
              onClick={() => go(-1)}
              disabled={matches.length === 0}
            >
              上一个(↑)
            </button>
            <button
              className="sta-nav"
              title="下一个 (Enter)"
              onClick={() => go(1)}
              disabled={matches.length === 0}
            >
              下一个(↓)
            </button>
            <button
              className="sta-close"
              title="关闭 (Esc)"
              onClick={() => {
                setOpen(false);
                taRef.current?.focus();
              }}
            >
              ×
            </button>
          </div>

          {showReplace && !readOnly && (
            <div className="sta-row">
              <span className="sta-expand" />
              <div className="sta-fieldwrap">
                <input
                  ref={replaceInputRef}
                  className="sta-field"
                  placeholder="替换"
                  value={replace}
                  onChange={(e) => setReplace(e.target.value)}
                  disabled={flipCaseMode}
                />
              </div>
              <button
                className="sta-opt"
                title="插入换行符 \n"
                onClick={() => insertEscape("\\n")}
                disabled={flipCaseMode}
              >
                换行(\n)
              </button>
              <button
                className="sta-opt"
                title="插入制表符 \t"
                onClick={() => insertEscape("\\t")}
                disabled={flipCaseMode}
              >
                制表(\t)
              </button>
              <button
                className={`sta-opt ${flipCaseMode ? "on" : ""}`}
                title="翻转大小写：替换为匹配文本的大小写翻转结果"
                onClick={() => setFlipCaseMode((f) => !f)}
              >
                翻转大小写(aA)
              </button>
              <button
                className="sta-textbtn"
                onClick={replaceCurrent}
                disabled={matches.length === 0}
              >
                替换
              </button>
              <button
                className="sta-textbtn"
                onClick={replaceAll}
                disabled={matches.length === 0}
              >
                全部替换
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
