// permissionDialogTimeout.ts — 权限弹窗超时配置

const STORAGE_KEY = "ccagent:permDialogTimeout";
const DEFAULT_TIMEOUT = 60; // seconds

export function getPermissionDialogTimeout(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) {
      const n = parseInt(v, 10);
      if (!isNaN(n) && n >= 10 && n <= 600) return n;
    }
  } catch { /* ignore */ }
  return DEFAULT_TIMEOUT;
}

export function setPermissionDialogTimeout(seconds: number): void {
  try {
    if (seconds >= 10 && seconds <= 600) {
      localStorage.setItem(STORAGE_KEY, String(seconds));
    }
  } catch { /* ignore */ }
}

export function resetPermissionDialogTimeout(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
