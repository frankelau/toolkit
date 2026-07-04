// useCodexProviderManagement — Codex Provider 管理
// 对齐 cc-gui useCodexProviderManagement

import { usePersistentState } from "../../../../../storage";

export interface CodexProviderManagement {
  providerId: string;
  setProviderId: (s: string) => void;
  baseUrl: string;
  setBaseUrl: (s: string) => void;
  apiKey: string;
  setApiKey: (s: string) => void;
  model: string;
  setModel: (s: string) => void;
}

export function useCodexProviderManagement(ns: string): CodexProviderManagement {
  const [providerId, setProviderId] = usePersistentState(`${ns}:codex:provider`, "official");
  const [baseUrl, setBaseUrl] = usePersistentState(`${ns}:codex:baseUrl`, "");
  const [apiKey, setApiKey] = usePersistentState(`${ns}:codex:apiKey`, "");
  const [model, setModel] = usePersistentState(`${ns}:codex:model`, "");

  return { providerId, setProviderId, baseUrl, setBaseUrl, apiKey, setApiKey, model, setModel };
}
