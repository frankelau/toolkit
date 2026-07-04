// useMessageSender — 消息发送
// 对齐 cc-gui useMessageSender

import { useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage, Attachment } from "../types";

export interface MessageSenderOptions {
  sessionId: string | null;
  ensureSession: () => Promise<string | null>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setStreaming: (b: boolean) => void;
  setError: (s: string) => void;
}

export interface MessageSender {
  send: (content: string, attachments?: Attachment[]) => Promise<void>;
  streamingMsgRef: React.RefObject<ChatMessage | null>;
}

export function useMessageSender(opts: MessageSenderOptions): MessageSender {
  const streamingMsgRef = useRef<ChatMessage | null>(null);

  const send = useCallback(async (content: string, attachments?: Attachment[]) => {
    if (!content.trim()) return;
    let sid = opts.sessionId;
    if (!sid) {
      sid = await opts.ensureSession();
      if (!sid) { opts.setError("无法启动会话"); return; }
    }

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      role: "user", content,
      timestamp: Date.now(),
      attachments: attachments?.length ? attachments : undefined,
    };
    opts.setMessages(prev => [...prev, userMsg]);

    const bridgeAttachments = attachments?.map(a => ({ type: "image" as const, data: a.data, mimeType: a.mimeType }));

    const assistantMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      role: "assistant", content: "",
      isStreaming: true, timestamp: Date.now(),
    };
    streamingMsgRef.current = assistantMsg;
    opts.setMessages(prev => [...prev, assistantMsg]);
    opts.setStreaming(true);

    try {
      await invoke("cc_send_message", {
        sessionId: sid, message: content,
        attachments: bridgeAttachments?.length ? bridgeAttachments : undefined,
      });
    } catch (e) {
      opts.setStreaming(false);
      opts.setError(`发送失败：${(e as Error).message ?? e}`);
      if (streamingMsgRef.current) {
        streamingMsgRef.current.content = `❌ 发送失败`;
        streamingMsgRef.current.isStreaming = false;
        opts.setMessages(prev => [...prev]);
        streamingMsgRef.current = null;
      }
    }
  }, [opts]);

  return { send, streamingMsgRef };
}
