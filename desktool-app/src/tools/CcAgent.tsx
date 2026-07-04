import type { ToolProps } from "./types";
import "highlight.js/styles/github-dark.css";
import "./CcAgent.css";
import { useCcAgentState } from "./ccagent/hooks/useCcAgentState";
import { ChatScreen } from "./ccagent/components/ChatScreen";

// Sprint G: CcAgent.tsx 从 1566 行缩减为薄包装层
// 所有状态和逻辑迁移到 useCcAgentState hook
// UI 渲染迁移到 ChatScreen 组件
export default function CcAgent(props: ToolProps) {
  const state = useCcAgentState(props);
  return <ChatScreen state={state} />;
}
