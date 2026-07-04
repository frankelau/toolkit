// useNativeEventCapture — 原生事件捕获
// 对齐 cc-gui useNativeEventCapture

import { useEffect, type RefObject } from "react";

export interface NativeEventOptions {
  onPaste?: (e: ClipboardEvent) => void;
  onDrop?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDragLeave?: (e: DragEvent) => void;
}

export function useNativeEventCapture(
  ref: RefObject<HTMLElement | null>,
  opts: NativeEventOptions
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handlers: Array<[string, EventListener]> = [];
    if (opts.onPaste) { el.addEventListener("paste", opts.onPaste as EventListener); handlers.push(["paste", opts.onPaste as EventListener]); }
    if (opts.onDrop) { el.addEventListener("drop", opts.onDrop as EventListener); handlers.push(["drop", opts.onDrop as EventListener]); }
    if (opts.onDragOver) { el.addEventListener("dragover", opts.onDragOver as EventListener); handlers.push(["dragover", opts.onDragOver as EventListener]); }
    if (opts.onDragLeave) { el.addEventListener("dragleave", opts.onDragLeave as EventListener); handlers.push(["dragleave", opts.onDragLeave as EventListener]); }

    return () => handlers.forEach(([evt, fn]) => el.removeEventListener(evt, fn));
  }, [ref, opts.onPaste, opts.onDrop, opts.onDragOver, opts.onDragLeave]);
}
