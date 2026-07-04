// useModelProviderState — 模型/Provider/开关状态（对齐 cc-gui useModelProviderState）
// Sprint A: 集中管理 model/effort/permissionMode/streaming/thinking/provider 状态

import { useCallback, useMemo } from "react";

interface UseModelProviderStateOptions<T> {
  values: Record<string, T>;
  setters: Record<string, (v: T) => void>;
}

/** 把一组持久化状态和 setter 聚合成统一的 provider state 对象 */
export function useModelProviderState<T extends string | boolean>({
  values, setters,
}: UseModelProviderStateOptions<T>) {
  const state = useMemo(() => values, [values]);

  const update = useCallback(<K extends keyof typeof values>(key: K, value: typeof values[K]) => {
    const setter = setters[key as string] as (v: T) => void;
    if (setter) setter(value);
  }, [setters]);

  return { state, update };
}
