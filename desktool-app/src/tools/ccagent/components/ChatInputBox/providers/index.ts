// providers barrel exports — Sprint B + Sprint N
// 对齐 cc-gui ChatInputBox/providers/index.ts

export { fetchFileCompletions } from "./fileReferenceProvider";
export type { FileEntry } from "./fileReferenceProvider";

export { getSlashCompletions } from "./slashCommandProvider";

export { getDollarCompletions } from "./dollarCommandProvider";

export { getAgentCompletions } from "./agentProvider";

export { promptProvider, promptToDropdownItem, resetPromptsState, preloadPrompts, forceRefreshPrompts, updatePromptsCache } from "./promptProvider";
export type { PromptItem, PromptDropdownItem } from "./promptProvider";
