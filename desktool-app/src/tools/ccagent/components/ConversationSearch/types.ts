// ConversationSearch/types.ts — 会话搜索类型（对齐 cc-gui）
// Sprint U3: 补齐缺失组件

export interface ConversationSearchMatch {
  id: string;
  markElement: HTMLElement | null;
  blockElement: HTMLElement | null;
  preview?: string;
}

export interface ConversationSearchHandle {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
}

export interface MessageListRevealHandle {
  revealAll: () => number;
}

// Re-export from the hook for convenience
export type { SearchOptions } from "../../hooks/useConversationSearch";
