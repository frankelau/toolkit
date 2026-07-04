// virtualCursorUtils.ts — 虚拟光标位置工具（contenteditable + file-tag）
// 对齐 cc-gui ChatInputBox/utils/virtualCursorUtils.ts
// file-tag (<span data-file-path>) 在虚拟文本中计为 "@filepath"

function textEndsWithNewline(text: string | null): boolean {
  return text !== null && text.length > 0 && text.endsWith("\n");
}

/**
 * 获取虚拟光标位置（file-tag 计为 @filepath 长度）。
 * 返回字符偏移，光标不在元素内返回 0。
 */
export function getVirtualCursorPosition(element: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  let position = 0;
  let found = false;
  let endsWithNewline = false;

  const walk = (node: Node): boolean => {
    if (found) return true;

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (range.endContainer === node) {
        position += range.endOffset;
        found = true;
        return true;
      }
      position += text.length;
      endsWithNewline = textEndsWithNewline(text);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();

      if (tagName === "br") {
        if (range.endContainer === el ||
            (range.endContainer === element && el === element.childNodes[range.endOffset - 1])) {
          found = true;
          return true;
        }
        position += 1;
        endsWithNewline = true;
        return false;
      }

      if (tagName === "div" || tagName === "p") {
        if (position > 0 && !endsWithNewline) {
          position += 1;
          endsWithNewline = true;
        }
        if (range.endContainer === el) {
          const children = Array.from(el.childNodes);
          for (let i = 0; i < range.endOffset && i < children.length; i++) {
            const child = children[i];
            if (child.nodeType === Node.TEXT_NODE) {
              position += child.textContent?.length || 0;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              const childEl = child as HTMLElement;
              const childTag = childEl.tagName.toLowerCase();
              if (childTag === "br") position += 1;
              else if (childEl.classList.contains("file-tag")) {
                position += (childEl.getAttribute("data-file-path") || "").length + 1;
              } else position += childEl.textContent?.length || 0;
            }
          }
          found = true;
          return true;
        }
        for (const child of Array.from(el.childNodes)) {
          if (walk(child)) return true;
        }
        return false;
      }

      if (el.classList.contains("file-tag")) {
        const filePath = el.getAttribute("data-file-path") || "";
        const tagLength = filePath.length + 1;
        if (el.contains(range.endContainer)) {
          position += tagLength;
          found = true;
          return true;
        }
        position += tagLength;
        endsWithNewline = false;
      } else {
        if (range.endContainer === el) {
          const children = Array.from(el.childNodes);
          for (let i = 0; i < range.endOffset && i < children.length; i++) {
            const child = children[i];
            if (child.nodeType === Node.TEXT_NODE) {
              position += child.textContent?.length || 0;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              const childEl = child as HTMLElement;
              const childTag = childEl.tagName.toLowerCase();
              if (childTag === "br") position += 1;
              else if (childEl.classList.contains("file-tag")) {
                position += (childEl.getAttribute("data-file-path") || "").length + 1;
              } else position += childEl.textContent?.length || 0;
            }
          }
          found = true;
          return true;
        }
        for (const child of Array.from(node.childNodes)) {
          if (walk(child)) return true;
        }
      }
    }
    return false;
  };

  for (const child of Array.from(element.childNodes)) {
    if (walk(child)) break;
  }
  return position;
}

/**
 * 设置虚拟光标位置。遍历 DOM 树，将虚拟偏移映射到正确的 DOM 节点/偏移。
 * file-tag 内的位置会将光标置于 tag 之后。
 */
export function setVirtualCursorPosition(element: HTMLElement, virtualOffset: number): boolean {
  const selection = window.getSelection();
  if (!selection) return false;

  let position = 0;
  let targetNode: Node | null = null;
  let targetOffset = 0;
  let endsWithNewline = false;

  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      const len = text.length;
      if (position + len >= virtualOffset) {
        targetNode = node;
        targetOffset = virtualOffset - position;
        return true;
      }
      position += len;
      endsWithNewline = textEndsWithNewline(text);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();

      if (tagName === "br") {
        if (position + 1 >= virtualOffset) {
          targetNode = el;
          targetOffset = 0;
          return true;
        }
        position += 1;
        endsWithNewline = true;
        return false;
      }

      if (tagName === "div" || tagName === "p") {
        if (position > 0 && !endsWithNewline) {
          if (position + 1 >= virtualOffset) {
            targetNode = el;
            targetOffset = 0;
            return true;
          }
          position += 1;
          endsWithNewline = true;
        }
        for (const child of Array.from(el.childNodes)) {
          if (walk(child)) return true;
        }
        return false;
      }

      if (el.classList.contains("file-tag")) {
        const filePath = el.getAttribute("data-file-path") || "";
        const tagLength = filePath.length + 1;
        if (position + tagLength >= virtualOffset) {
          targetNode = el;
          targetOffset = -1; // sentinel: tag 之后
          return true;
        }
        position += tagLength;
        endsWithNewline = false;
      } else {
        for (const child of Array.from(node.childNodes)) {
          if (walk(child)) return true;
        }
      }
    }
    return false;
  };

  for (const child of Array.from(element.childNodes)) {
    if (walk(child)) break;
  }

  if (!targetNode) {
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

  try {
    const range = document.createRange();
    const node: Node = targetNode;

    if (targetOffset === -1) {
      range.setStartAfter(node);
      range.collapse(true);
    } else if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      const maxOffset = textNode.textContent?.length ?? 0;
      range.setStart(textNode, Math.min(targetOffset, maxOffset));
      range.collapse(true);
    } else {
      range.selectNodeContents(node as HTMLElement);
      range.collapse(false);
    }

    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  } catch {
    return false;
  }
}
