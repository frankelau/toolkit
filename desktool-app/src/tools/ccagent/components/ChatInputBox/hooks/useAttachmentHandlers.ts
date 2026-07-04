// useAttachmentHandlers — 附件处理（对齐 cc-gui useAttachmentHandlers）
// Sprint B: 图片上传/粘贴/拖拽，base64 编码，附件列表管理

import { useCallback, useState } from "react";
import type { Attachment } from "../../../types";

export interface UseAttachmentHandlersOptions {
  maxAttachments?: number;
  maxImageSize?: number; // bytes
}

export interface UseAttachmentHandlersReturn {
  attachments: Attachment[];
  addImageFile: (file: File) => boolean;
  addImageBase64: (data: string, mimeType: string, name?: string) => void;
  removeAttachment: (index: number) => void;
  clearAttachments: () => void;
  handlePaste: (e: React.ClipboardEvent) => boolean;
  handleDrop: (e: React.DragEvent) => boolean;
  toBridgeAttachments: () => { type: "image"; data: string; mimeType: string }[];
}

const DEFAULT_MAX = 5;
const DEFAULT_SIZE = 10 * 1024 * 1024; // 10MB

export function useAttachmentHandlers({
  maxAttachments = DEFAULT_MAX,
  maxImageSize = DEFAULT_SIZE,
}: UseAttachmentHandlersOptions = {}): UseAttachmentHandlersReturn {
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const addImageFile = useCallback((file: File): boolean => {
    if (!file.type.startsWith("image/")) return false;
    if (file.size > maxImageSize) return false;
    setAttachments(prev => {
      if (prev.length >= maxAttachments) return prev;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1] || "";
        setAttachments(curr => [...curr, {
          type: "image", data: base64, mimeType: file.type, name: file.name,
        }]);
      };
      reader.readAsDataURL(file);
      return prev;
    });
    return true;
  }, [maxAttachments, maxImageSize]);

  const addImageBase64 = useCallback((data: string, mimeType: string, name = "pasted-image") => {
    setAttachments(prev => {
      if (prev.length >= maxAttachments) return prev;
      return [...prev, { type: "image", data, mimeType, name }];
    });
  }, [maxAttachments]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearAttachments = useCallback(() => setAttachments([]), []);

  const handlePaste = useCallback((e: React.ClipboardEvent): boolean => {
    const items = e.clipboardData?.items;
    if (!items) return false;
    let handled = false;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file && addImageFile(file)) handled = true;
      }
    }
    return handled;
  }, [addImageFile]);

  const handleDrop = useCallback((e: React.DragEvent): boolean => {
    const files = e.dataTransfer?.files;
    if (!files) return false;
    let handled = false;
    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/") && addImageFile(file)) handled = true;
    }
    return handled;
  }, [addImageFile]);

  const toBridgeAttachments = useCallback(() => {
    return attachments.map(a => ({ type: "image" as const, data: a.data, mimeType: a.mimeType }));
  }, [attachments]);

  return {
    attachments, addImageFile, addImageBase64,
    removeAttachment, clearAttachments,
    handlePaste, handleDrop, toBridgeAttachments,
  };
}
