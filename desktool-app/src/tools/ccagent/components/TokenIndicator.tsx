// TokenIndicator — 实时 Token 计数指示器（对齐 cc-gui TokenIndicator）
import { useMemo } from "react";

interface Props {
  text: string;
  /** Estimated tokens per character (claude ~0.25 tokens/char) */
  ratio?: number;
}

export function TokenIndicator({ text, ratio = 0.25 }: Props) {
  const tokens = useMemo(() => Math.ceil(text.length * ratio), [text, ratio]);

  const color = tokens > 8000 ? "var(--error, #e55)" : tokens > 4000 ? "var(--warning, #ea5)" : "var(--text-muted, #888)";

  return (
    <span className="cc-token-indicator" style={{ color, fontSize: 11 }}>
      ~{tokens.toLocaleString()} tokens
    </span>
  );
}
