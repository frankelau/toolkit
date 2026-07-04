// usePluginModels — 插件模型管理
// 对齐 cc-gui usePluginModels

import { useState, useCallback, useEffect } from "react";

export interface CustomModel {
  value: string;
  label: string;
}

export function usePluginModels(storageKey: string) {
  const [models, setModels] = useState<CustomModel[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setModels(JSON.parse(raw) as CustomModel[]);
    } catch { /* ignore */ }
  }, [storageKey]);

  const updateModels = useCallback((newModels: CustomModel[]) => {
    setModels(newModels);
    try { localStorage.setItem(storageKey, JSON.stringify(newModels)); } catch { /* ignore */ }
  }, [storageKey]);

  const addModel = useCallback((value: string, label: string) => {
    setModels(prev => {
      const next = [...prev, { value, label }];
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [storageKey]);

  const removeModel = useCallback((value: string) => {
    setModels(prev => {
      const next = prev.filter(m => m.value !== value);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [storageKey]);

  return { models, setModels: updateModels, addModel, removeModel };
}
