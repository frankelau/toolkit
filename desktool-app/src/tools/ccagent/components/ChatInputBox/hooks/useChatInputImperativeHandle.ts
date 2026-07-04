// useChatInputImperativeHandle — 命令式 handle（暴露给父组件）
// 对齐 cc-gui useChatInputImperativeHandle

import { useImperativeHandle, type RefObject } from "react";

export interface ChatInputImperativeHandle {
  focus: () => void;
  blur: () => void;
  setValue: (v: string) => void;
  getValue: () => string;
  insertAtCursor: (text: string) => void;
  clear: () => void;
}

export function useChatInputImperativeHandle(
  ref: React.Ref<ChatInputImperativeHandle | null>,
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  value: string,
  setValue: (v: string) => void
) {
  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    blur: () => textareaRef.current?.blur(),
    setValue: (v: string) => setValue(v),
    getValue: () => value,
    insertAtCursor: (text: string) => {
      const ta = textareaRef.current;
      if (!ta) { setValue(value + text); return; }
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      setValue(value.slice(0, start) + text + value.slice(end));
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + text.length;
        ta.setSelectionRange(pos, pos);
      });
    },
    clear: () => setValue(""),
  }), [textareaRef, value, setValue]);
}
