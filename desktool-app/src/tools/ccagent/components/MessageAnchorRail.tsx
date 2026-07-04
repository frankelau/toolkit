// MessageAnchorRail — 消息锚点侧边栏导航（对齐 cc-gui MessageAnchorRail）
// 右侧快速跳转到指定消息类型（用户/助手/工具/错误）

import { useMemo } from "react";
import type { ChatMessage } from "../types";

interface Anchor {
  index: number;
  type: "user" | "assistant" | "tool" | "error" | "thinking";
  label: string;
  icon: string;
}

interface Props {
  messages: ChatMessage[];
  /** If set, only show when there are more than this many messages */
  minMessages?: number;
  onJumpTo: (messageIndex: number) => void;
}

export function MessageAnchorRail({ messages, minMessages = 3, onJumpTo }: Props) {
  const anchors = useMemo<Anchor[]>(() => {
    const result: Anchor[] = [];
    messages.forEach((m, i) => {
      if (m.role === "user") {
        const preview = (m.content || "").slice(0, 40);
        result.push({ index: i, type: "user", label: preview || "(图片)", icon: "👤" });
      } else if (m.role === "assistant") {
        if (m.thinking) {
          result.push({ index: i, type: "thinking", label: "思考…", icon: "💭" });
        }
        if (m.toolUses && m.toolUses.length > 0) {
          result.push({ index: i, type: "tool", label: `${m.toolUses.length} 个工具调用`, icon: "🔧" });
        }
        const preview = (m.content || "").slice(0, 40);
        if (preview) {
          result.push({ index: i, type: "assistant", label: preview, icon: "🤖" });
        }
      }
    });
    // Deduplicate by index
    const seen = new Set<number>();
    return result.filter(a => {
      if (seen.has(a.index)) return false;
      seen.add(a.index);
      return true;
    });
  }, [messages]);

  if (messages.length < minMessages) return null;

  return (
    <div className="cc-anchor-rail">
      {anchors.map((a) => (
        <div
          key={a.index}
          className={`cc-anchor-dot cc-anchor-${a.type}`}
          title={`[${a.type}] ${a.label}`}
          onClick={() => onJumpTo(a.index)}
        >
          <span className="cc-anchor-icon">{a.icon}</span>
        </div>
      ))}
    </div>
  );
}
