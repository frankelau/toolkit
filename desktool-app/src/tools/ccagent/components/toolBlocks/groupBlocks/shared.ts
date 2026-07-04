// ToolGroupBlock 共享类型 + 工具分组工具函数

import type { ToolUseBlock } from "../../../types";

export interface GroupedTool {
  tool: ToolUseBlock;
  index: number;
}

export interface ToolGroupBlockProps {
  items: GroupedTool[];
  /** 组内默认展开第几个（默认 0） */
  defaultExpandedIndex?: number;
}

/** 把连续的同名工具调用分组 */
export function groupConsecutiveTools(tools: ToolUseBlock[]): GroupedTool[][] {
  const groups: GroupedTool[][] = [];
  let current: GroupedTool[] = [];
  let currentName = "";

  tools.forEach((tool, index) => {
    if (current.length === 0) {
      current.push({ tool, index });
      currentName = tool.name;
    } else if (tool.name === currentName) {
      current.push({ tool, index });
    } else {
      groups.push(current);
      current = [{ tool, index }];
      currentName = tool.name;
    }
  });
  if (current.length > 0) groups.push(current);
  return groups;
}

/** 判断工具是否应被分组（连续 2 次以上才分组） */
export function shouldGroup(tools: ToolUseBlock[]): boolean {
  const groups = groupConsecutiveTools(tools);
  return groups.some(g => g.length >= 2);
}
