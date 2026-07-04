// useSubmitHandler — 提交处理
// 对齐 cc-gui useSubmitHandler

import { useCallback } from "react";
import type { Attachment } from "../../../types";

export interface SubmitHandlerOptions {
  streaming: boolean;
  disabled: boolean;
  onSubmit: (content: string, attachments?: Attachment[]) => Promise<void>;
  onClear: () => void;
}

export interface SubmitHandler {
  handleSubmit: (content: string, attachments?: Attachment[]) => Promise<void>;
  canSubmit: (content: string) => boolean;
}

export function useSubmitHandler(opts: SubmitHandlerOptions): SubmitHandler {
  const canSubmit = useCallback((content: string) => {
    return content.trim().length > 0 && !opts.streaming && !opts.disabled;
  }, [opts.streaming, opts.disabled]);

  const handleSubmit = useCallback(async (content: string, attachments?: Attachment[]) => {
    if (!canSubmit(content)) return;
    await opts.onSubmit(content.trim(), attachments);
    opts.onClear();
  }, [canSubmit, opts]);

  return { handleSubmit, canSubmit };
}
