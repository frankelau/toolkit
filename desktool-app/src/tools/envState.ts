import { useState, useEffect, useCallback } from "react";
import { loadState, saveState } from "../storage";

export interface EnvVar {
  key: string;
  value: string;
}

export interface Env {
  id: string;
  name: string;
  baseUrl: string;
  vars: EnvVar[];
}

const ENVS_KEY = "hostconfig:envs";
const ACTIVE_KEY = "hostconfig:active";

/** 自定义事件名，用于跨组件通知环境变更 */
export const ENV_CHANGED_EVENT = "hostconfig-changed";

/**
 * 全局环境管理 Hook。
 * 从 localStorage 读取环境列表和当前激活环境，
 * 当 HostConfig 修改环境时通过自定义事件通知所有使用方。
 */
export function useEnvs() {
  const [envs, setEnvs] = useState<Env[]>(() => loadState<Env[]>(ENVS_KEY, []));
  const [activeId, setActiveId] = useState<string>(() => loadState<string>(ACTIVE_KEY, ""));

  useEffect(() => {
    function refresh() {
      setEnvs(loadState<Env[]>(ENVS_KEY, []));
      setActiveId(loadState<string>(ACTIVE_KEY, ""));
    }
    window.addEventListener("storage", refresh);
    window.addEventListener(ENV_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(ENV_CHANGED_EVENT, refresh);
    };
  }, []);

  const setActive = useCallback((id: string) => {
    saveState(ACTIVE_KEY, id);
    setActiveId(id);
    window.dispatchEvent(new CustomEvent(ENV_CHANGED_EVENT));
  }, []);

  const activeEnv = activeId ? envs.find((e) => e.id === activeId) ?? null : null;

  /** 激活环境的变量列表，自动注入 baseUrl */
  const activeVars: EnvVar[] = activeEnv
    ? [
        ...(activeEnv.baseUrl ? [{ key: "baseUrl", value: activeEnv.baseUrl }] : []),
        ...activeEnv.vars,
      ]
    : [];

  return { envs, activeId, activeEnv, activeVars, setActive };
}
