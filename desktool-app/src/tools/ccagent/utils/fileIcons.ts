// fileIcons.ts — 文件图标映射

const ICON_MAP: Record<string, string> = {
  ts: "🟦", tsx: "🟦", js: "🟨", jsx: "🟨", json: "🟧",
  py: "🐍", java: "☕", kt: "🟪", rs: "🦀", go: "🐹",
  rb: "💎", php: "🐘", c: "🔵", cpp: "🔵", h: "🔵",
  html: "🌐", css: "🎨", scss: "🎨", less: "🎨",
  vue: "🟩", svelte: "🟧",
  yml: "⚙", yaml: "⚙", toml: "⚙", ini: "⚙",
  xml: "📄", env: "🔒",
  md: "📝", txt: "📄", pdf: "📕", doc: "📘", docx: "📘",
  png: "🖼", jpg: "🖼", jpeg: "🖼", gif: "🖼", svg: "🖼", webp: "🖼",
  zip: "📦", tar: "📦", gz: "📦", rar: "📦", "7z": "📦",
  csv: "📊", sql: "🗄", db: "🗄", sqlite: "🗄",
  sh: "🔧", bash: "🔧", zsh: "🔧",
  lock: "🔒", log: "📜",
};

const DIR_ICON = "📁";
const DEFAULT_ICON = "📄";

export function getFileIcon(name: string, isDir = false): string {
  if (isDir) return DIR_ICON;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ICON_MAP[ext] ?? DEFAULT_ICON;
}

export function getFileColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const colorMap: Record<string, string> = {
    ts: "#3178c6", tsx: "#3178c6", js: "#f7df1e", jsx: "#f7df1e",
    py: "#3776ab", java: "#ed8b00", rs: "#dea584", go: "#00add8",
    rb: "#cc342d", html: "#e34c26", css: "#563d7c", vue: "#42b883",
  };
  return colorMap[ext] ?? "#888";
}
