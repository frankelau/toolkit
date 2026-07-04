// useIMEComposition — IME 组合输入处理（对齐 cc-gui useIMEComposition）
// Sprint B: 输入法组合期间不触发快捷键

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseIMECompositionReturn {
  isComposing: boolean;
  compositionStartRef: React.RefObject<boolean>;
  handleCompositionStart: () => void;
  handleCompositionEnd: () => void;
  /** 检查当前是否在组合中（用于键盘事件守卫） */
  checkComposing: () => boolean;
}

export function useIMEComposition(): UseIMECompositionReturn {
  const [isComposing, setIsComposing] = useState(false);
  const compositionStartRef = useRef(false);

  const handleCompositionStart = useCallback(() => {
    compositionStartRef.current = true;
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback(() => {
    compositionStartRef.current = false;
    setIsComposing(false);
  }, []);

  const checkComposing = useCallback(() => compositionStartRef.current, []);

  // 兜底：如果 compositionEnd 没触发（某些浏览器 bug），用 input 事件清理
  useEffect(() => {
    if (isComposing) {
      const timer = setTimeout(() => {
        if (compositionStartRef.current) {
          compositionStartRef.current = false;
          setIsComposing(false);
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isComposing]);

  return {
    isComposing,
    compositionStartRef,
    handleCompositionStart,
    handleCompositionEnd,
    checkComposing,
  };
}
