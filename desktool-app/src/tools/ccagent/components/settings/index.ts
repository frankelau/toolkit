// Settings barrel exports — Sprint D + Sprint K + Sprint P

// Sprint D: 原单文件组件（Sprint P 已目录化，路径自动解析到 /index）
export { SettingsView } from "./SettingsView";
export { SettingsSidebar } from "./SettingsSidebar";
export type { SettingsTab, SettingsSidebarItem } from "./SettingsSidebar";
export { SettingsHeader } from "./SettingsHeader";
export { BasicConfigSection } from "./BasicConfigSection";
export { ProviderTabSection } from "./ProviderTabSection";
export { ProviderList } from "./ProviderList";
export { ProviderDialog } from "./ProviderDialog";
export { CodexProviderSection } from "./CodexProviderSection";
export { PromptEnhancerSection } from "./PromptEnhancerSection";
export { PermissionsSection } from "./PermissionsSection";
export { DependencySection } from "./DependencySection";
export { CommitSection } from "./CommitSection";
export { CommunitySection } from "./CommunitySection";
export { OtherSettingsSection } from "./OtherSettingsSection";

// Sprint K: 子目录版本（对齐 cc-gui 结构）
// 注意：使用 /index 显式路径避免与同名单文件冲突

// BasicConfigSection 三 tab 拆分版（AppearanceTab / BehaviorTab / EnvironmentTab）
export { default as BasicConfigSectionV2 } from "./BasicConfigSection/index";
export type { BasicConfigSectionProps as BasicConfigSectionV2Props } from "./BasicConfigSection/index";
export { default as AppearanceTab } from "./BasicConfigSection/AppearanceTab";
export { default as BehaviorTab } from "./BasicConfigSection/BehaviorTab";
export { default as EnvironmentTab } from "./BasicConfigSection/EnvironmentTab";

// PromptSection（PromptScopeSection + PromptExportDialog + PromptImportConfirmDialog）
export { default as PromptSection } from "./PromptSection/index";
export { default as PromptScopeSection } from "./PromptSection/PromptScopeSection";
export type { PromptScope } from "./PromptSection/PromptScopeSection";
export { default as PromptExportDialog } from "./PromptSection/PromptExportDialog";
export { default as PromptImportConfirmDialog } from "./PromptSection/PromptImportConfirmDialog";
export type { PromptImportPreview, ConflictStrategy } from "./PromptSection/PromptImportConfirmDialog";

// ProviderManageSection（整合 ProviderList + ProviderDialog + 删除确认）
export { default as ProviderManageSection } from "./ProviderManageSection/index";

// CustomModelDialog（自定义模型添加弹窗）
export { default as CustomModelDialog } from "./CustomModelDialog/index";
export type { CustomModel } from "./CustomModelDialog/index";

// AiFeatureProviderModelPanel + AiFeatureSettingsCard
export { default as AiFeatureProviderModelPanel } from "./AiFeatureProviderModelPanel/index";
export type { AiFeatureConfig } from "./AiFeatureProviderModelPanel/index";
export { default as AiFeatureSettingsCard } from "./AiFeatureSettingsCard/index";

// UsageSection（使用统计设置区）
export { default as UsageSection } from "./UsageSection/index";

// SettingsDialogs（设置弹窗编排）
export { default as SettingsDialogs } from "./SettingsDialogs";
export type {
  AlertDialogState, DeleteConfirmState,
  ProviderDialogState, AgentDialogState,
  CodexProviderDialogState, PromptDialogState,
} from "./SettingsDialogs";

// Sprint K: shared 共享样式与工具
export {
  SECTION_TITLE_STYLE, FORM_ROW_STYLE, LABEL_STYLE, VALUE_CONTAINER_STYLE,
  TOGGLE_ROW_STYLE, CARD_STYLE, DESCRIPTION_STYLE,
  SUB_TAB_NAV_STYLE, INPUT_STYLE, SELECT_STYLE,
  BUTTON_STYLE, PRIMARY_BUTTON_STYLE,
  getSubTabButtonStyle, getProviderCardStyle,
  formatBytes, formatTimestamp,
} from "./shared";

// Sprint K: settings hooks barrel（Sprint I 已完成，重新导出）
export {
  useAgentManagement, useCodexProviderManagement, useDragSort,
  usePluginModels, usePromptManagement, useProviderManagement,
  useSettingsBasicActions, useSettingsPageState, useSettingsThemeSync,
  useSettingsWindowCallbacks,
} from "./hooks";

// Sprint P: settings 子目录辅助文件补全
export { normalizeVersion, compareVersions, getVersionAction, buildVersionOptions } from "./DependencySection/versioning";
export type { VersionAction } from "./DependencySection/versioning";
export { HistoryItemEditor } from "./OtherSettingsSection/HistoryItemEditor";
export type { HistoryItemEditorProps } from "./OtherSettingsSection/HistoryItemEditor";
export { ImportConfirmDialog } from "./ProviderList/ImportConfirmDialog";
export type { ImportConfirmDialogProps, ImportPreviewItem } from "./ProviderList/ImportConfirmDialog";
export { AgentExportDialog } from "./AgentSection";
export type { AgentExportDialogProps } from "./AgentSection";
export { AgentImportConfirmDialog } from "./AgentSection";
export type { AgentImportConfirmDialogProps, AgentImportPreview } from "./AgentSection";
export { PlaceholderSection } from "./PlaceholderSection";
export type { PlaceholderSectionProps } from "./PlaceholderSection";
