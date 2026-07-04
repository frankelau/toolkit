// debounce.ts — 防抖工具（带 cancel/flush）
// 对齐 cc-gui ChatInputBox/utils/debounce.ts

export interface DebouncedFunction<Args extends unknown[]> {
  (...args: Args): void;
  /** 取消待执行 */
  cancel: () => void;
  /** 立即执行待执行的回调（使用最后一次参数） */
  flush: () => void;
}

/**
 * 防抖函数：延迟 wait 毫秒后执行，期间多次调用只执行最后一次。
 * @example
 * const debouncedFn = debounce(myFn, 300);
 * debouncedFn('arg1');
 * debouncedFn.cancel(); // 取消
 * debouncedFn.flush();  // 立即执行
 */
export function debounce<Args extends unknown[]>(
  func: (...args: Args) => void,
  wait: number,
): DebouncedFunction<Args> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Args | null = null;
  let lastThis: unknown = null;

  const debouncedFn = function (this: unknown, ...args: Args) {
    lastArgs = args;
    lastThis = this;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      const a = lastArgs;
      const ctx = lastThis;
      lastArgs = null;
      lastThis = null;
      if (a) func.apply(ctx, a);
    }, wait);
  } as DebouncedFunction<Args>;

  debouncedFn.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    lastArgs = null;
    lastThis = null;
  };

  debouncedFn.flush = () => {
    if (timeout && lastArgs) {
      clearTimeout(timeout);
      timeout = null;
      const args = lastArgs;
      const ctx = lastThis;
      lastArgs = null;
      lastThis = null;
      func.apply(ctx, args);
    }
  };

  return debouncedFn;
}
