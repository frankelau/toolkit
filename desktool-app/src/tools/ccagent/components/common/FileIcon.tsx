// FileIcon — 根据文件扩展名返回图标

const ICON_MAP: Record<string, string> = {
  // 代码
  ts: "🟦", tsx: "🟦", js: "🟨", jsx: "🟨", json: "🟧",
  py: "🐍", java: "☕", kt: "🟪", rs: "🦀", go: "🐹",
  rb: "💎", php: "🐘", c: "🔵", cpp: "🔵", h: "🔵",
  // Web
  html: "🌐", css: "🎨", scss: "🎨", less: "🎨",
  vue: "🟩", svelte: "🟧",
  // 配置
  yml: "⚙", yaml: "⚙", toml: "⚙", ini: "⚙",
  xml: "📄", env: "🔒",
  // 文档
  md: "📝", txt: "📄", pdf: "📕", doc: "📘", docx: "📘",
  // 图片
  png: "🖼", jpg: "🖼", jpeg: "🖼", gif: "🖼", svg: "🖼", webp: "🖼",
  // 压缩
  zip: "📦", tar: "📦", gz: "📦", rar: "📦", "7z": "📦",
  // 数据
  csv: "📊", sql: "🗄", db: "🗄", sqlite: "🗄",
  // 其它
  sh: "🔧", bash: "🔧", zsh: "🔧",
  lock: "🔒", log: "📜",
};

const DIR_ICON = "📁";

export function FileIcon({ name, isDir = false }: { name: string; isDir?: boolean }) {
  if (isDir) return <span className="cc-file-icon">{DIR_ICON}</span>;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const icon = ICON_MAP[ext] ?? "📄";
  return <span className="cc-file-icon">{icon}</span>;
}
