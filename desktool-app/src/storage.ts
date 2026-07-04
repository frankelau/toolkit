import { useEffect, useRef, useState } from "react";

const PREFIX = "desktool:";

/** 读取持久化值，失败返回 fallback */
export function loadState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 写入持久化值 */
export function saveState<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 存储满或被禁用时静默忽略
  }
}

/** 删除某个键 */
export function removeState(key: string): void {
  localStorage.removeItem(PREFIX + key);
}

/** 删除某前缀下的所有键（用于关闭标签时清理实例数据） */
export function removeByPrefix(prefix: string): void {
  const full = PREFIX + prefix;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith(full)) localStorage.removeItem(k);
  }
}

/**
 * 与 useState 用法一致，但值会持久化到 localStorage。
 * key 应包含工具实例 id，确保多标签各自独立。
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => loadState(key, initial));

  // key 变化时重新加载（实例切换场景）
  const keyRef = useRef(key);
  useEffect(() => {
    if (keyRef.current !== key) {
      keyRef.current = key;
      setState(loadState(key, initial));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    saveState(key, state);
  }, [key, state]);

  return [state, setState];
}
