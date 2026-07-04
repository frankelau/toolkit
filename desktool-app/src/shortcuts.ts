export type ShortcutAction = "run" | "clear" | "export" | "deleteLine";

export const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");

const KEY: Record<ShortcutAction, { key: string; label: string }> = {
  run: { key: "Enter", label: "Enter" },
  clear: { key: "k", label: "K" },
  export: { key: "s", label: "S" },
  deleteLine: { key: "d", label: "D" },
};

/** 返回按平台可读的快捷键文案，如 "⌘Enter" / "Ctrl+Enter" */
export function shortcutHint(action: ShortcutAction): string {
  const { label } = KEY[action];
  return isMac ? `⌘${label}` : `Ctrl+${label}`;
}

/** 判断键盘事件是否命中某动作（meta on mac / ctrl elsewhere + 对应键） */
export function matchShortcut(
  e: { key: string; ctrlKey: boolean; metaKey: boolean },
  action: ShortcutAction,
): boolean {
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (!mod) return false;
  return e.key.toLowerCase() === KEY[action].key.toLowerCase();
}
