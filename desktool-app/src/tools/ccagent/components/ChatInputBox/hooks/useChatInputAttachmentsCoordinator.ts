// useChatInputAttachmentsCoordinator — 附件协调
// 对齐 cc-gui useChatInputAttachmentsCoordinator

import { useCallback } from "react";
import type { Attachment } from "../../../types";

export interface AttachmentsCoordinator {
  addAttachment: (attachment: Attachment) => void;
  removeAttachment: (index: number) => void;
  clearAttachments: () => void;
  hasAttachments: () => boolean;
  getBridgeAttachments: () => Array<{ type: "image"; data: string; mimeType: string }>;
}

export function useChatInputAttachmentsCoordinator(
  attachments: Attachment[],
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>,
  maxAttachments: number = 10
): AttachmentsCoordinator {
  const addAttachment = useCallback((a: Attachment) => {
    setAttachments(prev => prev.length >= maxAttachments ? prev : [...prev, a]);
  }, [setAttachments, maxAttachments]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, [setAttachments]);

  const clearAttachments = useCallback(() => setAttachments([]), [setAttachments]);

  const hasAttachments = useCallback(() => attachments.length > 0, [attachments]);

  const getBridgeAttachments = useCallback(() =>
    attachments.map(a => ({ type: "image" as const, data: a.data, mimeType: a.mimeType })),
  [attachments]);

  return { addAttachment, removeAttachment, clearAttachments, hasAttachments, getBridgeAttachments };
}
