// useMessageQueue — 消息排队发送（对齐 cc-gui useMessageQueue）
// Sprint A: 流式响应期间用户发送的消息进入队列，流结束后自动发送

import { useCallback, useRef, useState } from "react";

interface QueuedMessage {
  id: string;
  text: string;
  attachments?: { type: "image"; data: string; mimeType: string }[];
  queuedAt: number;
}

interface UseMessageQueueOptions {
  /** 当前是否在流式响应中 */
  streaming: boolean;
  /** 实际发送函数 */
  send: (text: string, attachments?: { type: "image"; data: string; mimeType: string }[]) => Promise<void>;
}

export function useMessageQueue({ streaming, send }: UseMessageQueueOptions) {
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const processingRef = useRef(false);

  /** 入队（流式中调用）或直接发送（非流式） */
  const enqueue = useCallback(
    async (text: string, attachments?: { type: "image"; data: string; mimeType: string }[]) => {
      if (!streaming) {
        // 非流式，直接发
        await send(text, attachments);
        return;
      }
      // 流式中，入队
      setQueue(prev => [
        ...prev,
        { id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, attachments, queuedAt: Date.now() },
      ]);
    },
    [streaming, send],
  );

  /** 流式结束后处理队列 */
  const processQueue = useCallback(async () => {
    if (processingRef.current || streaming) return;
    if (queue.length === 0) return;
    processingRef.current = true;
    const next = queue[0];
    setQueue(prev => prev.slice(1));
    try {
      await send(next.text, next.attachments);
    } catch {
      // 发送失败，丢弃这条（避免死循环）
    } finally {
      processingRef.current = false;
    }
  }, [queue, streaming, send]);

  /** 清空队列 */
  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  /** 移除队列中指定项 */
  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => prev.filter(m => m.id !== id));
  }, []);

  return {
    queue,
    queueLength: queue.length,
    enqueue,
    processQueue,
    clearQueue,
    removeFromQueue,
  };
}
