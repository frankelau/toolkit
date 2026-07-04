// index.ts — ChatInputBox utils barrel exports
// 对齐 cc-gui ChatInputBox/utils/index.ts

export { debounce, type DebouncedFunction } from "./debounce";
export { escapeHtmlAttr } from "./htmlEscape";
export { generateId } from "./generateId";
export {
  insertTextAtCursor, createTextFragment, deleteSelection, deleteToPosition,
  getCursorOffset, setCursorOffset,
} from "./selectionUtils";
export { getVirtualCursorPosition, setVirtualCursorPosition } from "./virtualCursorUtils";
