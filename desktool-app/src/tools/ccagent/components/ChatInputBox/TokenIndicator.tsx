// TokenIndicator — Token 数估算指示器（对齐 cc-gui TokenIndicator）
// Sprint B: 粗略估算当前输入的 token 数

interface TokenIndicatorProps {
  text: string;
  /** 已用上下文 tokens（可选） */
  usedContext?: number;
  /** 上下文上限 */
  maxContext?: number;
}

/** 粗略估算：英文 ~4字符/token，中文 ~2字符/token，混合取 3 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const other = text.length - cjk;
  return Math.ceil(cjk / 2 + other / 4);
}

export function TokenIndicator({ text, usedContext, maxContext }: TokenIndicatorProps) {
  const tokens = estimateTokens(text);
  const total = (usedContext ?? 0) + tokens;
  const pct = maxContext ? Math.min(100, (total / maxContext) * 100) : 0;
  const isWarn = pct > 80;
  const isDanger = pct > 95;

  return (
    <span
      className={`cc-token-indicator ${isDanger ? "cc-token-danger" : isWarn ? "cc-token-warn" : ""}`}
      title={`当前输入 ~${tokens} tokens${maxContext ? `，上下文 ${total}/${maxContext}` : ""}`}
    >
      ~{tokens}t{maxContext ? ` · ${pct.toFixed(0)}%` : ""}
    </span>
  );
}
