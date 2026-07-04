// ChatInputBoxFooter — 输入框底部状态栏（对齐 cc-gui ChatInputBoxFooter）
// Sprint B: ConfigSelect + TokenIndicator + 消息队列提示

import type { Engine, AgentConfig } from "../../types";
import { ConfigSelect } from "./selectors";
import { TokenIndicator } from "./TokenIndicator";

interface ChatInputBoxFooterProps {
  engine: Engine;
  model: string;
  setModel: (m: string) => void;
  permissionMode: string;
  setPermissionMode: (m: string) => void;
  streamingEnabled: boolean;
  setStreamingEnabled: (v: boolean) => void;
  thinkingEnabled: boolean;
  setThinkingEnabled: (v: boolean) => void;
  providerId: string;
  setProviderId: (id: string) => void;
  agents: AgentConfig[];
  onUseAgent: (a: AgentConfig) => void;
  onOpenAgentSettings: () => void;
  inputText: string;
  usedContext?: number;
  maxContext?: number;
  queueLength: number;
}

export function ChatInputBoxFooter(props: ChatInputBoxFooterProps) {
  return (
    <div className="cc-input-footer">
      <ConfigSelect
        engine={props.engine}
        model={props.model}
        setModel={props.setModel}
        permissionMode={props.permissionMode}
        setPermissionMode={props.setPermissionMode}
        streamingEnabled={props.streamingEnabled}
        setStreamingEnabled={props.setStreamingEnabled}
        thinkingEnabled={props.thinkingEnabled}
        setThinkingEnabled={props.setThinkingEnabled}
        providerId={props.providerId}
        setProviderId={props.setProviderId}
        agents={props.agents}
        onUseAgent={props.onUseAgent}
        onOpenAgentSettings={props.onOpenAgentSettings}
      />
      <div style={{ flex: 1 }} />
      {props.queueLength > 0 && (
        <span className="cc-queue-badge" title={`${props.queueLength} 条排队中`}>📋 {props.queueLength}</span>
      )}
      <TokenIndicator text={props.inputText} usedContext={props.usedContext} maxContext={props.maxContext} />
    </div>
  );
}
