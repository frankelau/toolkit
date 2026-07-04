// useAttachmentPersistence — 附件持久化
// 对齐 cc-gui useAttachmentPersistence

import { useState, useCallback, useEffect } from "react";
import type { Attachment } from "../../../types";

const STORAGE_KEY_PREFIX = "ccagent:attachments:";

export interface AttachmentPersistence {
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  loadFromStorage: (sessionId: string) => void;
  saveToStorage: (sessionId: string) => void;
  clearStorage: (sessionId: string) => void;
}

export function useAttachmentPersistence(sessionId?: string | null): AttachmentPersistence {
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const loadFromStorage = useCallback((sid: string) => {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${sid}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Attachment[];
        setAttachments(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  const saveToStorage = useCallback((sid: string) => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${sid}`, JSON.stringify(attachments));
    } catch { /* ignore */ }
  }, [attachments]);

  const clearStorage = useCallback((sid: string) => {
    try { localStorage.removeItem(`${STORAGE_KEY_PREFIX}${sid}`); } catch { /* ignore */ }
  }, []);

  // 会话切换时加载/保存
  useEffect(() => {
    if (sessionId) {
      loadFromStorage(sessionId);
    } else {
      setAttachments([]);
    }
  }, [sessionId, loadFromStorage]);

  return { attachments, setAttachments, loadFromStorage, saveToStorage, clearStorage };
}
