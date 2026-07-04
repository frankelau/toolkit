// useSettingsPageState — 设置页状态
// 对齐 cc-gui useSettingsPageState

import { useState } from "react";

export type SettingsTab =
  | "basic" | "claude-provider" | "codex-provider" | "prompt-enhancer"
  | "agent" | "prompt" | "mcp" | "skills" | "permissions"
  | "usage" | "dependency" | "commit" | "community" | "other";

export interface SettingsPageState {
  activeTab: SettingsTab;
  setActiveTab: (t: SettingsTab) => void;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  filteredTabs: SettingsTab[];
  isDirty: boolean;
  setDirty: (b: boolean) => void;
}

export function useSettingsPageState(): SettingsPageState {
  const [activeTab, setActiveTab] = useState<SettingsTab>("basic");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDirty, setDirty] = useState(false);

  const allTabs: SettingsTab[] = [
    "basic", "claude-provider", "codex-provider", "prompt-enhancer",
    "agent", "prompt", "mcp", "skills", "permissions",
    "usage", "dependency", "commit", "community", "other",
  ];

  const filteredTabs = searchQuery.trim()
    ? allTabs.filter(t => t.includes(searchQuery.toLowerCase()))
    : allTabs;

  return { activeTab, setActiveTab, searchQuery, setSearchQuery, filteredTabs, isDirty, setDirty };
}
