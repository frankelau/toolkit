// selectionUtils.ts — 选区工具（contenteditable 元素）
// 对齐 cc-gui ChatInputBox/utils/selectionUtils.ts
// 使用现代 Selection/Range API 替代废弃的 document.execCommand

/** 大文本插入阈值（超过则使用快速 Range API） */
const LARGE_TEXT_INSERTION = 5000;

/**
 * 在当前光标位置插入文本。
 * 小文本用 execCommand 保留 undo 历史；大/多行文本用 Range API（更快但不支持原生 undo）。
 */
export function insertTextAtCursor(text: string, element?: HTMLElement | null): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  const range = selection.getRangeAt(0);

  if (element && !element.contains(range.commonAncestorContainer)) {
    return false;
  }

  if (text.length > LARGE_TEXT_INSERTION || text.includes("\n")) {
    return insertTextFast(text, element, selection, range);
  }

  const execCommandSuccess = document.execCommand("insertText", false, text);
  if (execCommandSuccess) return true;

  return insertTextFast(text, element, selection, range);
}

/** 创建 DocumentFragment，把 \n 转为 <br>，保证光标垂直导航正确 */
export function createTextFragment(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) fragment.appendChild(document.createElement("br"));
    if (lines[i]) fragment.appendChild(document.createTextNode(lines[i]));
  }
  return fragment;
}

/** 快速插入：使用 Range API，适合大文本 */
function insertTextFast(
  text: string,
  element: HTMLElement | null | undefined,
  selection: Selection,
  range: Range,
): boolean {
  if (!range.collapsed) range.deleteContents();

  const fragment = createTextFragment(text);
  const lastChild = fragment.lastChild;
  range.insertNode(fragment);

  if (lastChild) range.setStartAfter(lastChild);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);

  if (element) {
    element.dispatchEvent(new InputEvent("input", {
      bubbles: true, cancelable: true, inputType: "insertText", data: text,
    }));
  }
  return true;
}

/** 删除选区内容 */
export function deleteSelection(element?: HTMLElement | null): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  const range = selection.getRangeAt(0);
  if (element && !element.contains(range.commonAncestorContainer)) return false;
  if (range.collapsed) return false;

  range.deleteContents();
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);

  if (element) {
    element.dispatchEvent(new InputEvent("input", {
      bubbles: true, cancelable: true, inputType: "deleteContentBackward",
    }));
  }
  return true;
}

/** 获取光标在 contenteditable 元素中的字符偏移 */
export function getCursorOffset(element: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return -1;

  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer)) return -1;

  const preCaretRange = document.createRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.startContainer, range.startOffset);

  return preCaretRange.toString().length;
}

/** 设置光标到指定字符偏移 */
export function setCursorOffset(element: HTMLElement, offset: number): boolean {
  if (offset < 0) return false;
  const selection = window.getSelection();
  if (!selection) return false;

  let currentOffset = 0;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

  let node = walker.nextNode() as Text | null;
  while (node) {
    const nodeLength = node.textContent?.length || 0;
    if (currentOffset + nodeLength >= offset) {
      const range = document.createRange();
      const nodeOffset = offset - currentOffset;
      range.setStart(node, Math.min(nodeOffset, nodeLength));
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    }
    currentOffset += nodeLength;
    node = walker.nextNode() as Text | null;
  }

  if (element.lastChild) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }
  return false;
}

/** 从当前光标删到指定位置（用于 Cmd+Backspace） */
export function deleteToPosition(
  targetNode: Node,
  targetOffset: number,
  element?: HTMLElement | null,
): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  const currentRange = selection.getRangeAt(0);
  if (element && !element.contains(currentRange.commonAncestorContainer)) return false;

  const deleteRange = document.createRange();
  deleteRange.setStart(targetNode, targetOffset);
  deleteRange.setEnd(currentRange.startContainer, currentRange.startOffset);

  if (deleteRange.collapsed) return false;
  deleteRange.deleteContents();
  selection.removeAllRanges();
  selection.addRange(deleteRange);

  if (element) {
    element.dispatchEvent(new InputEvent("input", {
      bubbles: true, cancelable: true, inputType: "deleteContentBackward",
    }));
  }
  return true;
}
