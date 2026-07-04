// useIsToolDenied — 判断工具是否被拒绝
// 对齐 cc-gui useIsToolDenied

import { useState, useCallback } from "react";

export interface ToolDeniedState {
  deniedToolIds: Set<string>;
  isDenied: (toolId: string) => boolean;
  deny: (toolId: string) => void;
  allow: (toolId: string) => void;
  clear: () => void;
}

export function useIsToolDenied(): ToolDeniedState {
  const [deniedToolIds, setDeniedToolIds] = useState<Set<string>>(new Set());

  const isDenied = useCallback((toolId: string) => deniedToolIds.has(toolId), [deniedToolIds]);

  const deny = useCallback((toolId: string) => {
    setDeniedToolIds(prev => new Set(prev).add(toolId));
  }, []);

  const allow = useCallback((toolId: string) => {
    setDeniedToolIds(prev => {
      const next = new Set(prev);
      next.delete(toolId);
      return next;
    });
  }, []);

  const clear = useCallback(() => setDeniedToolIds(new Set()), []);

  return { deniedToolIds, isDenied, deny, allow, clear };
}
