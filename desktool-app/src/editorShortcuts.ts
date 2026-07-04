/**
 * 全局编辑器快捷键：Ctrl/Cmd+D 删除当前整行。
 * 通过原生 value setter + 派发 input 事件，使 React 受控 textarea/input 也能感知。
 */

function setNativeValue(el: HTMLTextAreaElement | HTMLInputElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** 删除光标所在整行（含行尾换行）。返回是否处理。 */
function deleteCurrentLine(el: HTMLTextAreaElement): boolean {
  const value = el.value;
  const pos = el.selectionStart ?? 0;
  // 当前行起止
  let lineStart = value.lastIndexOf("\n", pos - 1) + 1;
  let lineEnd = value.indexOf("\n", pos);
  if (lineEnd === -1) lineEnd = value.length;
  else lineEnd += 1; // 含换行符

  // 若是最后一行且无尾换行，连带删除上一个换行
  let removeStart = lineStart;
  if (lineEnd === value.length && lineStart > 0 && value[lineEnd - 1] !== "\n") {
    removeStart = lineStart - 1;
  }

  const next = value.slice(0, removeStart) + value.slice(lineEnd);
  setNativeValue(el, next);
  // 光标落到被删行原起始处（截断到新长度）
  const caret = Math.min(lineStart, next.length);
  requestAnimationFrame(() => el.setSelectionRange(caret, caret));
  return true;
}

/** 安装全局监听，返回卸载函数 */
export function installEditorShortcuts(): () => void {
  const handler = (e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key !== "d" && e.key !== "D") return;
    const el = document.activeElement;
    if (el instanceof HTMLTextAreaElement) {
      e.preventDefault();
      deleteCurrentLine(el);
    }
  };
  window.addEventListener("keydown", handler, true);
  return () => window.removeEventListener("keydown", handler, true);
}

/**
 * 全局 Tab 缩进：在 textarea 内按 Tab 插入 2 空格（或选中时缩进），
 * 而非跳焦点到下一个元素。
 */
export function installTabIndent(): () => void {
  const handler = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const el = document.activeElement;
    if (!(el instanceof HTMLTextAreaElement)) return;
    // 排除有自定义 Tab 处理的组件（如 SearchableTextarea 的查找栏）
    if (el.dataset.noTabIndent === "true") return;

    e.preventDefault();
    const { selectionStart: start, selectionEnd: end, value } = el;
    if (start === end) {
      // 无选区：插入 2 空格
      setNativeValue(el, value.slice(0, start) + "  " + value.slice(end));
      requestAnimationFrame(() => el.setSelectionRange(start + 2, start + 2));
    } else {
      // 有选区：每行加/减缩进
      const hasShift = e.shiftKey;
      const before = value.slice(0, start);
      const after = value.slice(end);
      const lineStart = before.lastIndexOf("\n") + 1;

      const fullSel = value.slice(lineStart, end);
      const lines = fullSel.split("\n");
      if (hasShift) {
        // 减少缩进
        const newLines = lines.map(l => l.startsWith("  ") ? l.slice(2) : (l.startsWith(" ") ? l.slice(1) : l));
        const newSel = newLines.join("\n");
        setNativeValue(el, value.slice(0, lineStart) + newSel + after);
        const newEnd = lineStart + newSel.length;
        requestAnimationFrame(() => el.setSelectionRange(lineStart, newEnd));
      } else {
        // 增加缩进
        const newLines = lines.map(l => "  " + l);
        const newSel = newLines.join("\n");
        setNativeValue(el, value.slice(0, lineStart) + newSel + after);
        const newEnd = lineStart + newSel.length;
        requestAnimationFrame(() => el.setSelectionRange(lineStart, newEnd));
      }
    }
  };
  window.addEventListener("keydown", handler, true);
  return () => window.removeEventListener("keydown", handler, true);
}
