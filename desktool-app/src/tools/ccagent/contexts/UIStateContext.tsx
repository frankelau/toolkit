// UIStateContext — UI 视图状态（对齐 cc-gui UIStateContext）
// Sprint A: 从 CcAgent.tsx 拆出 UI 导航/搜索/Toast 状态

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type ViewMode = "chat" | "settings" | "history" | "git" | "terminal";

export interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

export interface UIStateContextValue {
  // 当前视图
  activeTab: ViewMode;
  setActiveTab: React.Dispatch<React.SetStateAction<ViewMode>>;
  // 对话内搜索
  showSearch: boolean;
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  // Toast 队列
  toasts: ToastMessage[];
  addToast: (message: string, type?: ToastMessage["type"]) => void;
  dismissToast: (id: string) => void;
  // Bootstrap 状态
  bootstrapping: boolean;
  setBootstrapping: React.Dispatch<React.SetStateAction<boolean>>;
  bridgeReady: boolean;
  setBridgeReady: React.Dispatch<React.SetStateAction<boolean>>;
}

const UIStateContext = createContext<UIStateContextValue | null>(null);

let toastIdCounter = 0;

export function UIStateProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<ViewMode>("chat");
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bridgeReady, setBridgeReady] = useState(false);

  const addToast = (message: string, type: ToastMessage["type"] = "info") => {
    const id = `toast-${++toastIdCounter}`;
    setToasts(prev => [...prev, { id, message, type }]);
    // 3 秒后自动消失
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const value = useMemo<UIStateContextValue>(
    () => ({
      activeTab, setActiveTab,
      showSearch, setShowSearch,
      searchQuery, setSearchQuery,
      toasts, addToast, dismissToast,
      bootstrapping, setBootstrapping,
      bridgeReady, setBridgeReady,
    }),
    [activeTab, showSearch, searchQuery, toasts, bootstrapping, bridgeReady],
  );

  return <UIStateContext.Provider value={value}>{children}</UIStateContext.Provider>;
}

export function useUIState(): UIStateContextValue {
  const ctx = useContext(UIStateContext);
  if (ctx === null) throw new Error("useUIState must be used within a UIStateProvider");
  return ctx;
}

export { UIStateContext };
