// MessageQueue — 消息队列 UI（对齐 cc-gui MessageQueue）
// Sprint B: 显示排队的消息，支持移除

interface QueuedMessage {
  id: string;
  text: string;
  queuedAt: number;
}

interface MessageQueueProps {
  queue: QueuedMessage[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function MessageQueue({ queue, onRemove, onClear }: MessageQueueProps) {
  if (queue.length === 0) return null;
  return (
    <div className="cc-msg-queue">
      <div className="cc-msg-queue-head">
        <span>📋 排队消息 ({queue.length})</span>
        <button className="cc-msg-queue-clear" onClick={onClear}>清空</button>
      </div>
      {queue.map(m => (
        <div key={m.id} className="cc-msg-queue-item">
          <span className="cc-msg-queue-text">{m.text.slice(0, 60)}{m.text.length > 60 ? "…" : ""}</span>
          <button className="cc-msg-queue-remove" onClick={() => onRemove(m.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
