// BasicConfigSection/index.tsx — 基础配置区（三 tab 编排）
// 对齐 cc-gui 的 BasicConfigSection/index.tsx
// 将原单文件 BasicConfigSection.tsx 拆为 AppearanceTab / BehaviorTab / EnvironmentTab

import { useState } from "react";
import { SUB_TAB_NAV_STYLE, getSubTabButtonStyle } from "../shared";
import AppearanceTab from "./AppearanceTab";
import BehaviorTab from "./BehaviorTab";
import EnvironmentTab from "./EnvironmentTab";

type BasicTab = "appearance" | "behavior" | "environment";

const BASIC_TABS: { key: BasicTab; label: string }[] = [
  { key: "appearance", label: "外观" },
  { key: "behavior", label: "行为" },
  { key: "environment", label: "环境" },
];

export interface BasicConfigSectionProps {
  // Appearance
  theme: "light" | "dark" | "system";
  onThemeChange: (theme: "light" | "dark" | "system") => void;
  fontSizeLevel: number;
  onFontSizeLevelChange: (level: number) => void;
  chatBgColor?: string;
  onChatBgColorChange?: (color: string) => void;
  userMsgColor?: string;
  onUserMsgColorChange?: (color: string) => void;
  diffTheme?: "light" | "dark" | "auto";
  onDiffThemeChange?: (theme: "light" | "dark" | "auto") => void;
  diffExpandedByDefault?: boolean;
  onDiffExpandedByDefaultChange?: (enabled: boolean) => void;
  // Behavior
  streamingEnabled?: boolean;
  onStreamingEnabledChange?: (enabled: boolean) => void;
  sendShortcut?: "enter" | "cmdEnter";
  onSendShortcutChange?: (shortcut: "enter" | "cmdEnter") => void;
  autoOpenFileEnabled?: boolean;
  onAutoOpenFileEnabledChange?: (enabled: boolean) => void;
  newSessionConfirmEnabled?: boolean;
  onNewSessionConfirmEnabledChange?: (enabled: boolean) => void;
  soundNotificationEnabled?: boolean;
  onSoundNotificationEnabledChange?: (enabled: boolean) => void;
  soundOnlyWhenUnfocused?: boolean;
  onSoundOnlyWhenUnfocusedChange?: (enabled: boolean) => void;
  commitGenerationEnabled?: boolean;
  onCommitGenerationEnabledChange?: (enabled: boolean) => void;
  aiTitleGenerationEnabled?: boolean;
  onAiTitleGenerationEnabledChange?: (enabled: boolean) => void;
  statusBarWidgetEnabled?: boolean;
  onStatusBarWidgetEnabledChange?: (enabled: boolean) => void;
  taskCompletionNotificationEnabled?: boolean;
  onTaskCompletionNotificationEnabledChange?: (enabled: boolean) => void;
  permissionDialogTimeoutSeconds?: number;
  onPermissionDialogTimeoutChange?: (seconds: number) => void;
  // Environment
  nodePath: string;
  onNodePathChange: (path: string) => void;
  onSaveNodePath: () => void;
  savingNodePath: boolean;
  nodeVersion?: string | null;
  minNodeVersion?: number;
  claudeCliPath?: string;
  onClaudeCliPathChange?: (path: string) => void;
  onSaveClaudeCliPath?: () => void;
  savingClaudeCliPath?: boolean;
  workingDirectory?: string;
  onWorkingDirectoryChange?: (dir: string) => void;
  onSaveWorkingDirectory?: () => void;
  savingWorkingDirectory?: boolean;
}

export default function BasicConfigSection(props: BasicConfigSectionProps) {
  const [activeTab, setActiveTab] = useState<BasicTab>("appearance");

  return (
    <div className="cc-basic-config-section">
      <div style={SUB_TAB_NAV_STYLE}>
        {BASIC_TABS.map(tab => (
          <button
            key={tab.key}
            style={getSubTabButtonStyle(activeTab === tab.key)}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "appearance" && (
        <AppearanceTab
          theme={props.theme}
          onThemeChange={props.onThemeChange}
          fontSizeLevel={props.fontSizeLevel}
          onFontSizeLevelChange={props.onFontSizeLevelChange}
          chatBgColor={props.chatBgColor}
          onChatBgColorChange={props.onChatBgColorChange}
          userMsgColor={props.userMsgColor}
          onUserMsgColorChange={props.onUserMsgColorChange}
          diffTheme={props.diffTheme}
          onDiffThemeChange={props.onDiffThemeChange}
          diffExpandedByDefault={props.diffExpandedByDefault}
          onDiffExpandedByDefaultChange={props.onDiffExpandedByDefaultChange}
        />
      )}

      {activeTab === "behavior" && (
        <BehaviorTab
          streamingEnabled={props.streamingEnabled}
          onStreamingEnabledChange={props.onStreamingEnabledChange}
          sendShortcut={props.sendShortcut}
          onSendShortcutChange={props.onSendShortcutChange}
          autoOpenFileEnabled={props.autoOpenFileEnabled}
          onAutoOpenFileEnabledChange={props.onAutoOpenFileEnabledChange}
          newSessionConfirmEnabled={props.newSessionConfirmEnabled}
          onNewSessionConfirmEnabledChange={props.onNewSessionConfirmEnabledChange}
          soundNotificationEnabled={props.soundNotificationEnabled}
          onSoundNotificationEnabledChange={props.onSoundNotificationEnabledChange}
          soundOnlyWhenUnfocused={props.soundOnlyWhenUnfocused}
          onSoundOnlyWhenUnfocusedChange={props.onSoundOnlyWhenUnfocusedChange}
          commitGenerationEnabled={props.commitGenerationEnabled}
          onCommitGenerationEnabledChange={props.onCommitGenerationEnabledChange}
          aiTitleGenerationEnabled={props.aiTitleGenerationEnabled}
          onAiTitleGenerationEnabledChange={props.onAiTitleGenerationEnabledChange}
          statusBarWidgetEnabled={props.statusBarWidgetEnabled}
          onStatusBarWidgetEnabledChange={props.onStatusBarWidgetEnabledChange}
          taskCompletionNotificationEnabled={props.taskCompletionNotificationEnabled}
          onTaskCompletionNotificationEnabledChange={props.onTaskCompletionNotificationEnabledChange}
          permissionDialogTimeoutSeconds={props.permissionDialogTimeoutSeconds}
          onPermissionDialogTimeoutChange={props.onPermissionDialogTimeoutChange}
        />
      )}

      {activeTab === "environment" && (
        <EnvironmentTab
          nodePath={props.nodePath}
          onNodePathChange={props.onNodePathChange}
          onSaveNodePath={props.onSaveNodePath}
          savingNodePath={props.savingNodePath}
          nodeVersion={props.nodeVersion}
          minNodeVersion={props.minNodeVersion}
          claudeCliPath={props.claudeCliPath}
          onClaudeCliPathChange={props.onClaudeCliPathChange}
          onSaveClaudeCliPath={props.onSaveClaudeCliPath}
          savingClaudeCliPath={props.savingClaudeCliPath}
          workingDirectory={props.workingDirectory}
          onWorkingDirectoryChange={props.onWorkingDirectoryChange}
          onSaveWorkingDirectory={props.onSaveWorkingDirectory}
          savingWorkingDirectory={props.savingWorkingDirectory}
        />
      )}
    </div>
  );
}
