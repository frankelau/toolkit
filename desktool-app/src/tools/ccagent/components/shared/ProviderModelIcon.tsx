// ProviderModelIcon.tsx — Provider/Model 图标组件
// 对齐 cc-gui 的 shared/ProviderModelIcon.tsx
// ccagent 无 @lobehub/icons 依赖，改用 emoji/首字母方案

import type { CSSProperties } from "react";

/** 模型厂商类型 */
export type ModelVendor =
  | "claude" | "openai" | "gemini" | "qwen" | "deepseek"
  | "kimi" | "moonshot" | "zhipu" | "minimax" | "xiaomi"
  | "doubao" | "spark" | "hunyuan" | "baichuan"
  | "mistral" | "meta" | "cohere" | "grok" | "openrouter" | "yi" | "unknown";

export interface ProviderModelIconProps {
  /** Provider 类型：claude, codex, gemini 等 */
  providerId?: string;
  /** 模型 ID（用于厂商特定图标解析） */
  modelId?: string;
  /** 图标大小（像素） */
  size?: number;
  /** 是否使用彩色变体 */
  colored?: boolean;
}

/** 厂商 emoji 图标映射 */
const VENDOR_EMOJI: Record<ModelVendor, string> = {
  claude: "🤖",
  openai: "🟢",
  gemini: "✨",
  qwen: "🌐",
  deepseek: "🔍",
  kimi: "🌙",
  moonshot: "🌙",
  zhipu: "🧠",
  minimax: "📊",
  xiaomi: "📱",
  doubao: "🫘",
  spark: "⚡",
  hunyuan: "☁️",
  baichuan: "🏔️",
  mistral: "🌬️",
  meta: "♾️",
  cohere: "🔗",
  grok: "✖️",
  openrouter: "🔀",
  yi: "🎯",
  unknown: "🔌",
};

/** 厂商品牌色映射 */
const VENDOR_COLOR: Record<ModelVendor, string> = {
  claude: "#d97757",
  openai: "#10a37f",
  gemini: "#4285f4",
  qwen: "#615ced",
  deepseek: "#4d6bfe",
  kimi: "#1d1d1f",
  moonshot: "#1d1d1f",
  zhipu: "#0052ff",
  minimax: "#ff6b35",
  xiaomi: "#ff6900",
  doubao: "#3b5ffb",
  spark: "#e60012",
  hunyuan: "#0053e0",
  baichuan: "#f7941e",
  mistral: "#fa520f",
  meta: "#0866ff",
  cohere: "#39594d",
  grok: "#000000",
  openrouter: "#6466f1",
  yi: "#00b386",
  unknown: "#888888",
};

/** 厂商首字母映射（用于 mono 模式） */
const VENDOR_LETTER: Record<ModelVendor, string> = {
  claude: "C",
  openai: "O",
  gemini: "G",
  qwen: "Q",
  deepseek: "D",
  kimi: "K",
  moonshot: "M",
  zhipu: "Z",
  minimax: "X",
  xiaomi: "Mi",
  doubao: "B",
  spark: "S",
  hunyuan: "H",
  baichuan: "B",
  mistral: "M",
  meta: "M",
  cohere: "C",
  grok: "X",
  openrouter: "O",
  yi: "Y",
  unknown: "?",
};

/**
 * 根据 providerId 和 modelId 解析出厂商
 * 优先级：modelId 模式匹配 > providerId 查找 > claude 默认
 */
export function resolveIconVendor(providerId?: string, modelId?: string): ModelVendor {
  // 1. modelId 模式匹配
  if (modelId) {
    const mid = modelId.toLowerCase();
    if (mid.includes("gpt") || mid.includes("o3") || mid.includes("o4")) return "openai";
    if (mid.includes("gemini")) return "gemini";
    if (mid.includes("qwen")) return "qwen";
    if (mid.includes("deepseek")) return "deepseek";
    if (mid.includes("kimi")) return "kimi";
    if (mid.includes("moonshot")) return "moonshot";
    if (mid.includes("glm") || mid.includes("zhipu")) return "zhipu";
    if (mid.includes("minimax")) return "minimax";
    if (mid.includes("mimo")) return "xiaomi";
    if (mid.includes("doubao")) return "doubao";
    if (mid.includes("spark")) return "spark";
    if (mid.includes("hunyuan")) return "hunyuan";
    if (mid.includes("baichuan")) return "baichuan";
    if (mid.includes("mistral")) return "mistral";
    if (mid.includes("llama") || mid.includes("meta")) return "meta";
    if (mid.includes("cohere")) return "cohere";
    if (mid.includes("grok")) return "grok";
    if (mid.includes("openrouter")) return "openrouter";
    if (mid.includes("yi-")) return "yi";
  }
  // 2. providerId 查找
  if (providerId) {
    const pid = providerId.toLowerCase();
    if (pid === "claude") return "claude";
    if (pid === "codex" || pid === "openai") return "openai";
    if (pid === "gemini") return "gemini";
    if (pid === "qwen") return "qwen";
    if (pid === "deepseek") return "deepseek";
    if (pid === "kimi") return "kimi";
    if (pid === "zhipu") return "zhipu";
    if (pid === "minimax") return "minimax";
    if (pid === "xiaomi") return "xiaomi";
    if (pid === "openrouter") return "openrouter";
  }
  // 3. 默认 claude
  return "claude";
}

/**
 * 根据 provider 和 model 上下文渲染对应厂商图标
 * colored=true 使用 emoji，colored=false 使用首字母
 */
export function ProviderModelIcon({
  providerId,
  modelId,
  size = 16,
  colored = false,
}: ProviderModelIconProps) {
  const vendor = resolveIconVendor(providerId, modelId);
  const color = VENDOR_COLOR[vendor];

  if (colored) {
    // emoji 方案
    const fontSize = Math.round(size * 0.8);
    const style: CSSProperties = {
      width: size,
      height: size,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize,
      lineHeight: 1,
    };
    return <span style={style} aria-label={vendor}>{VENDOR_EMOJI[vendor]}</span>;
  }

  // mono 方案：圆角背景 + 首字母
  const style: CSSProperties = {
    width: size,
    height: size,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: Math.round(size * 0.5),
    fontWeight: 600,
    color: "#fff",
    background: color,
    borderRadius: Math.max(2, Math.round(size * 0.2)),
    lineHeight: 1,
    flex: "none",
  };
  return <span style={style} aria-label={vendor}>{VENDOR_LETTER[vendor]}</span>;
}
