// useOpenSourceBannerState — 开源 banner 状态
// 对齐 cc-gui useOpenSourceBannerState

import { useState, useEffect } from "react";

const STORAGE_KEY = "ccagent:openSourceBannerDismissed";

export function useOpenSourceBannerState() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch { /* ignore */ }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
  };

  const reset = () => {
    setDismissed(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  return { dismissed, dismiss, reset };
}
