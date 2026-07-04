// hooks barrel exports — Sprint B

export { useInputHistory } from "./useInputHistory";
export type { UseInputHistoryOptions, UseInputHistoryReturn } from "./useInputHistory";

export { useIMEComposition } from "./useIMEComposition";
export type { UseIMECompositionReturn } from "./useIMEComposition";

export { useAttachmentHandlers } from "./useAttachmentHandlers";
export type { UseAttachmentHandlersOptions, UseAttachmentHandlersReturn } from "./useAttachmentHandlers";

export { usePasteAndDrop } from "./usePasteAndDrop";

export { useCompletionDropdown } from "./useCompletionDropdown";
export type { CompletionType, CompletionItem, UseCompletionDropdownOptions, UseCompletionDropdownReturn } from "./useCompletionDropdown";

export { useKeyboardHandler } from "./useKeyboardHandler";

export * from "./inputHistoryStorage";

// Sprint I: 补齐的 20 个 hooks
export { useSubmitHandler } from "./useSubmitHandler";
export type { SubmitHandler, SubmitHandlerOptions } from "./useSubmitHandler";

export { usePromptEnhancer } from "./usePromptEnhancer";
export type { PromptEnhancerState } from "./usePromptEnhancer";

export { useResizableChatInputBox } from "./useResizableChatInputBox";
export type { ResizableInputState } from "./useResizableChatInputBox";

export { useAttachmentPersistence } from "./useAttachmentPersistence";
export type { AttachmentPersistence } from "./useAttachmentPersistence";

export { useChatInputAttachmentsCoordinator } from "./useChatInputAttachmentsCoordinator";
export type { AttachmentsCoordinator } from "./useChatInputAttachmentsCoordinator";

export { useChatInputCompletionsCoordinator } from "./useChatInputCompletionsCoordinator";

export { useChatInputImperativeHandle } from "./useChatInputImperativeHandle";
export type { ChatInputImperativeHandle } from "./useChatInputImperativeHandle";

export { useChatInputSelectionController } from "./useChatInputSelectionController";
export type { SelectionState } from "./useChatInputSelectionController";

export { useCompletionTriggerDetection } from "./useCompletionTriggerDetection";
export type { TriggerType, TriggerInfo } from "./useCompletionTriggerDetection";

export { useControlledValueSync } from "./useControlledValueSync";

export { useFileTags } from "./useFileTags";
export type { FileTag, FileTagsState } from "./useFileTags";

export { useGlobalCallbacks } from "./useGlobalCallbacks";
export type { GlobalCallbacksOptions } from "./useGlobalCallbacks";

export { useInlineHistoryCompletion } from "./useInlineHistoryCompletion";
export type { InlineHistoryState } from "./useInlineHistoryCompletion";

export { useKeyboardNavigation } from "./useKeyboardNavigation";
export type { KeyboardNavOptions } from "./useKeyboardNavigation";

export { useNativeEventCapture } from "./useNativeEventCapture";
export type { NativeEventOptions } from "./useNativeEventCapture";

export { useResetAttachmentsOnSessionChange } from "./useResetAttachmentsOnSessionChange";

export { useSpaceKeyListener } from "./useSpaceKeyListener";

export { useTextContent, estimateTokens } from "./useTextContent";

export { useTooltip } from "./useTooltip";
export type { TooltipInfo } from "./useTooltip";

export { useTriggerDetection } from "./useTriggerDetection";

export { useOpenSourceBannerState } from "./useOpenSourceBannerState";
