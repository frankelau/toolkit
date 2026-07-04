// usePasteAndDrop — 粘贴和拖拽处理（对齐 cc-gui usePasteAndDrop）
// Sprint B: 统一的 paste/drop 事件处理，支持图片和文件引用

import { useCallback } from "react";

interface UsePasteAndDropOptions {
  onImagePaste: (file: File) => boolean;
  onFileRef?: (filePath: string) => void;
  onTextPaste?: (text: string) => void;
}

interface UsePasteAndDropReturn {
  handlePaste: (e: React.ClipboardEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
}

export function usePasteAndDrop({
  onImagePaste, onFileRef, onTextPaste,
}: UsePasteAndDropOptions): UsePasteAndDropReturn {
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    let imageHandled = false;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file && onImagePaste(file)) {
          e.preventDefault();
          imageHandled = true;
        }
      }
    }
    if (imageHandled) return;

    // 文本粘贴
    if (onTextPaste) {
      const text = e.clipboardData?.getData("text/plain");
      if (text) onTextPaste(text);
    }
  }, [onImagePaste, onTextPaste]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) {
        onImagePaste(file);
      }
    }

    // 拖拽的文件路径（从 Finder/Explorer）
    const filePath = e.dataTransfer?.getData("text/plain");
    if (filePath && onFileRef) {
      onFileRef(filePath);
    }
  }, [onImagePaste, onFileRef]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return { handlePaste, handleDrop, handleDragOver };
}
