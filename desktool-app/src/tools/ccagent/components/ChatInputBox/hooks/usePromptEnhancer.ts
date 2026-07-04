// usePromptEnhancer — Prompt 增强
// 对齐 cc-gui usePromptEnhancer

import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Engine } from "../../../types";

export interface PromptEnhancerState {
  isOpen: boolean;
  isLoading: boolean;
  originalPrompt: string;
  enhancedPrompt: string;
  error: string | null;
  enhance: (prompt: string, engine: Engine) => Promise<void>;
  useEnhanced: (onUse: (text: string) => void) => void;
  keepOriginal: () => void;
  close: () => void;
}

export function usePromptEnhancer(): PromptEnhancerState {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [originalPrompt, setOriginalPrompt] = useState("");
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const enhance = useCallback(async (prompt: string, engine: Engine) => {
    if (!prompt.trim()) return;
    setOriginalPrompt(prompt);
    setEnhancedPrompt("");
    setError(null);
    setIsOpen(true);
    setIsLoading(true);
    try {
      const result = await invoke<string>("cc_enhance_prompt", { prompt, engine }).catch(() => null);
      if (result) {
        setEnhancedPrompt(result);
      } else {
        // 本地 fallback
        setEnhancedPrompt(buildLocalEnhanced(prompt));
      }
    } catch (e) {
      setError(String(e));
      setEnhancedPrompt(buildLocalEnhanced(prompt));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const useEnhanced = useCallback((onUse: (text: string) => void) => {
    if (enhancedPrompt) onUse(enhancedPrompt);
    setIsOpen(false);
    setIsLoading(false);
  }, [enhancedPrompt]);

  const keepOriginal = useCallback(() => {
    setIsOpen(false);
    setIsLoading(false);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsLoading(false);
  }, []);

  return { isOpen, isLoading, originalPrompt, enhancedPrompt, error, enhance, useEnhanced, keepOriginal, close };
}

function buildLocalEnhanced(raw: string): string {
  return [
    "请按以下要求执行：",
    "",
    "## 任务",
    raw,
    "",
    "## 要求",
    "1. 先分析需求，给出执行计划",
    "2. 分步骤实施，每步说明意图",
    "3. 完成后给出简要总结",
  ].join("\n");
}
