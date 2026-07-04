import type { ToolProps } from "./types";
import { usePersistentState } from "../storage";
import SearchableTextarea from "../components/SearchableTextarea";
import "./FindReplace.css";

/**
 * 查找替换工具（独立工具版）
 * 复用 SearchableTextarea，默认展开查找+替换栏，
 * 与 JSON/Markdown 编辑区共享同一套高亮、导航、转义插入、翻转大小写、撤销能力。
 * 文本内容按标签实例持久化。
 */
export default function FindReplace({ instanceId }: ToolProps) {
  const [text, setText] = usePersistentState(`fr:${instanceId}:text`, "");

  return (
    <div className="fr-tool">
      <div className="fr-tip">
        在下方粘贴文本，使用顶部工具栏查找替换。支持正则、全词、区分大小写、
        换行/制表插入、翻转大小写，以及 Cmd/Ctrl+Z 撤销。
      </div>
      <div className="fr-editor">
        <SearchableTextarea
          value={text}
          onChange={setText}
          placeholder="在此粘贴文本..."
          defaultOpen
          defaultShowReplace
          showLineNumbers
          dockPanel
        />
      </div>
    </div>
  );
}
