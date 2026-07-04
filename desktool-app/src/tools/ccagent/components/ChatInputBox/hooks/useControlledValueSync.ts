// useControlledValueSync — 受控值同步
// 对齐 cc-gui useControlledValueSync

import { useEffect, useRef, useState } from "react";

export function useControlledValueSync<T>(
  controlledValue: T,
  onChange: (v: T) => void
): [T, (v: T) => void] {
  const [internal, setInternal] = useState<T>(controlledValue);
  const lastExternal = useRef<T>(controlledValue);

  // 外部 controlledValue 变化时同步到 internal
  useEffect(() => {
    if (controlledValue !== lastExternal.current) {
      lastExternal.current = controlledValue;
      setInternal(controlledValue);
    }
  }, [controlledValue]);

  // 内部变化时通知外部
  const setValue = (v: T) => {
    setInternal(v);
    onChange(v);
  };

  return [internal, setValue];
}
