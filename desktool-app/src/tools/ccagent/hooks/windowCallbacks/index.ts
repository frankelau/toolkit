// windowCallbacks barrel exports — Sprint R2
// 对齐 cc-gui hooks/windowCallbacks/index.ts

export { parseSequence } from "./parseSequence";
export { buildResetTransientUiState, releaseSessionTransition } from "./sessionTransition";
export type { ResetTransientUiStateOptions } from "./sessionTransition";
export {
  startInitialSettingsRequest,
  startActiveProviderRequest,
  startModeRequest,
  startThinkingEnabledRequest,
  drainPendingSettings,
  drainAndRequestDependencyStatus,
} from "./settingsBootstrap";
export {
  OPTIMISTIC_MESSAGE_TIME_WINDOW,
  getStreamEndHandlingMode,
  getRawUuid,
  stripUuidFromRaw,
  preserveMessageIdentity,
  appendOptimisticMessageIfMissing,
  getMessageTimestampMs,
  preserveLastAssistantIdentity,
  mergeRawBlocksDuringStreaming,
  preserveStreamingAssistantContent,
  stripDuplicateTrailingToolMessages,
  preserveLatestMessagesOnShrink,
  ensureStreamingAssistantInList,
} from "./messageSync";
export { registerWindowCallbacks } from "./registerCallbacks";
export type { WindowCallbacksOptions, ContextInfo } from "./types";
