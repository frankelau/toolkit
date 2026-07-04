// useResetAttachmentsOnSessionChange — 会话切换重置附件
// 对齐 cc-gui useResetAttachmentsOnSessionChange

import { useEffect } from "react";

export function useResetAttachmentsOnSessionChange(
  sessionId: string | null,
  reset: () => void
) {
  useEffect(() => {
    // 会话 id 变化时重置附件
    reset();
  }, [sessionId, reset]);
}
