// useTextContent — 文本内容管理（token 估算等）
// 对齐 cc-gui useTextContent

import { useMemo } from "react";

/** 粗略估算 token 数（CJK ~2字符/token，英文 ~4字符/token） */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const otherChars = text.length - cjkChars;
  return Math.ceil(cjkChars / 2 + otherChars / 4);
}

export function useTextContent(text: string) {
  return useMemo(() => {
    const charCount = text.length;
    const lineCount = text ? text.split("\n").length : 0;
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    const tokenEstimate = estimateTokens(text);
    const isEmpty = text.trim().length === 0;
    return { charCount, lineCount, wordCount, tokenEstimate, isEmpty };
  }, [text]);
}
