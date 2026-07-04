// promptProvider.ts — Prompt 模板补全 Provider
// 对齐 cc-gui ChatInputBox/providers/promptProvider.ts
// 适配：用 Tauri invoke 调用 cc_list_prompt_templates；简化版（无 bridge 事件）

import { invoke } from "@tauri-apps/api/core";
import { t } from "../../../i18n";
import type { PromptTemplate } from "../../../types";

/** Prompt 补全项 */
export interface PromptItem {
  id: string;
  name: string;
  content: string;
  scope?: "global" | "project";
}

/** 下拉项数据 */
export interface PromptDropdownItem {
  id: string;
  label: string;
  description?: string;
  icon: string;
  type: "prompt" | "info";
  data: { prompt: PromptItem };
}

export const CREATE_NEW_PROMPT_ID = "__create_new__";
export const EMPTY_STATE_ID = "__empty_state__";

/** 缓存 */
let cachedPrompts: PromptItem[] = [];
let lastRefreshTime = 0;
let loadingPromise: Promise<PromptItem[]> | null = null;

const MIN_REFRESH_INTERVAL = 2000;

/** 重置缓存 */
export function resetPromptsState(): void {
  cachedPrompts = [];
  lastRefreshTime = 0;
  loadingPromise = null;
}

/** 从后端加载 Prompt 列表 */
async function fetchPrompts(force = false): Promise<PromptItem[]> {
  const now = Date.now();
  if (!force && now - lastRefreshTime < MIN_REFRESH_INTERVAL && cachedPrompts.length > 0) {
    return cachedPrompts;
  }

  if (loadingPromise && !force) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const data = await invoke<PromptTemplate[]>("cc_list_prompt_templates").catch(() => [] as PromptTemplate[]);
      cachedPrompts = data.map(p => ({
        id: p.id, name: p.name, content: p.content, scope: "global" as const,
      }));
      lastRefreshTime = Date.now();
      return cachedPrompts;
    } catch {
      return cachedPrompts;
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/** 按 query 过滤 */
function filterPrompts(prompts: PromptItem[], query: string): PromptItem[] {
  if (!query) return prompts;
  const q = query.toLowerCase();
  return prompts.filter(p =>
    p.name.toLowerCase().includes(q) || p.content.toLowerCase().includes(q),
  );
}

/**
 * Prompt 补全 Provider：输入 "!" 触发。
 * 返回匹配的 Prompt 列表 + "创建新 Prompt" 项。
 */
export async function promptProvider(query: string, signal: AbortSignal): Promise<PromptItem[]> {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  await fetchPrompts();

  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  const createNewItem: PromptItem = {
    id: CREATE_NEW_PROMPT_ID,
    name: t("settings.prompt.createPrompt") || "创建新 Prompt",
    content: "",
  };

  const filtered = filterPrompts(cachedPrompts, query);

  if (filtered.length === 0) {
    return [
      { id: EMPTY_STATE_ID, name: t("settings.prompt.noPromptsDropdown") || "暂无 Prompt", content: "" },
      createNewItem,
    ];
  }

  return [...filtered, createNewItem];
}

/** Prompt 项转下拉项 */
export function promptToDropdownItem(prompt: PromptItem): PromptDropdownItem {
  if (prompt.id === EMPTY_STATE_ID) {
    return {
      id: prompt.id, label: prompt.name, description: prompt.content,
      icon: "codicon-info", type: "info", data: { prompt },
    };
  }

  if (prompt.id === CREATE_NEW_PROMPT_ID) {
    return {
      id: prompt.id, label: prompt.name,
      description: t("settings.prompt.createPromptHint") || "创建一个新的 Prompt 模板",
      icon: "codicon-add", type: "prompt", data: { prompt },
    };
  }

  const scopeLabel = prompt.scope === "project" ? "[项目]" : "[全局]";

  return {
    id: prompt.id,
    label: `${prompt.name} ${scopeLabel}`,
    description: prompt.content
      ? (prompt.content.length > 60 ? prompt.content.substring(0, 60) + "..." : prompt.content)
      : undefined,
    icon: "codicon-bookmark",
    type: "prompt",
    data: { prompt },
  };
}

/** 直接更新缓存（由 settings 页面调用） */
export function updatePromptsCache(prompts: PromptItem[]): void {
  cachedPrompts = prompts;
  lastRefreshTime = Date.now();
}

/** 预加载 */
export function preloadPrompts(): void {
  fetchPrompts();
}

/** 强制刷新 */
export function forceRefreshPrompts(): void {
  fetchPrompts(true);
}

export default promptProvider;
