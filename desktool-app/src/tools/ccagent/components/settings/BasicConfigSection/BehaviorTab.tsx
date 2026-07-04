// BasicConfigSection/BehaviorTab.tsx — 行为设置 tab
// 对齐 cc-gui 的 BasicConfigSection/BehaviorTab.tsx
// 包含：流式响应、发送快捷键、自动打开文件、新会话确认、声音通知等

import { useLocale } from "../../../hooks/useLocale";
import {
  SECTION_TITLE_STYLE, FORM_ROW_STYLE, LABEL_STYLE, VALUE_CONTAINER_STYLE,
  DESCRIPTION_STYLE, SELECT_STYLE, TOGGLE_ROW_STYLE,
} from "../shared";

type SendShortcut = "enter" | "cmdEnter";

interface BehaviorTabProps {
  streamingEnabled?: boolean;
  onStreamingEnabledChange?: (enabled: boolean) => void;
  sendShortcut?: SendShortcut;
  onSendShortcutChange?: (shortcut: SendShortcut) => void;
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
}

export default function BehaviorTab({
  streamingEnabled,
  onStreamingEnabledChange,
  sendShortcut,
  onSendShortcutChange,
  autoOpenFileEnabled,
  onAutoOpenFileEnabledChange,
  newSessionConfirmEnabled,
  onNewSessionConfirmEnabledChange,
  soundNotificationEnabled,
  onSoundNotificationEnabledChange,
  soundOnlyWhenUnfocused,
  onSoundOnlyWhenUnfocusedChange,
  commitGenerationEnabled,
  onCommitGenerationEnabledChange,
  aiTitleGenerationEnabled,
  onAiTitleGenerationEnabledChange,
  statusBarWidgetEnabled,
  onStatusBarWidgetEnabledChange,
  taskCompletionNotificationEnabled,
  onTaskCompletionNotificationEnabledChange,
  permissionDialogTimeoutSeconds,
  onPermissionDialogTimeoutChange,
}: BehaviorTabProps) {
  const { t } = useLocale();
  return (
    <div className="cc-settings-tab-content">
      <h4 style={SECTION_TITLE_STYLE}>{t("behaviorTab.behaviorTab.k1")}</h4>

      {/* 流式响应 */}
      {streamingEnabled !== undefined && onStreamingEnabledChange && (
        <div style={TOGGLE_ROW_STYLE}>
          <div>
            <div style={{ fontSize: "13px" }}>{t("behaviorTab.behaviorTab.k2")}</div>
            <div style={DESCRIPTION_STYLE}>{t("behaviorTab.behaviorTab.k3")}</div>
          </div>
          <label className="cc-toggle-switch">
            <input type="checkbox" checked={streamingEnabled} onChange={e => onStreamingEnabledChange(e.target.checked)} />
            <span className="cc-toggle-slider" />
          </label>
        </div>
      )}

      {/* 发送快捷键 */}
      {sendShortcut !== undefined && onSendShortcutChange && (
        <div style={FORM_ROW_STYLE}>
          <label style={LABEL_STYLE}>{t("behaviorTab.behaviorTab.k4")}</label>
          <div style={VALUE_CONTAINER_STYLE}>
            <select style={SELECT_STYLE} value={sendShortcut} onChange={e => onSendShortcutChange(e.target.value as SendShortcut)}>
              <option value="enter">{t("behaviorTab.behaviorTab.k5")}</option>
              <option value="cmdEnter">{t("behaviorTab.behaviorTab.k6")}</option>
            </select>
          </div>
        </div>
      )}

      {/* 自动打开文件 */}
      {autoOpenFileEnabled !== undefined && onAutoOpenFileEnabledChange && (
        <div style={TOGGLE_ROW_STYLE}>
          <div>
            <div style={{ fontSize: "13px" }}>{t("behaviorTab.behaviorTab.k7")}</div>
            <div style={DESCRIPTION_STYLE}>{t("behaviorTab.behaviorTab.k8")}</div>
          </div>
          <label className="cc-toggle-switch">
            <input type="checkbox" checked={autoOpenFileEnabled} onChange={e => onAutoOpenFileEnabledChange(e.target.checked)} />
            <span className="cc-toggle-slider" />
          </label>
        </div>
      )}

      {/* 新会话确认 */}
      {newSessionConfirmEnabled !== undefined && onNewSessionConfirmEnabledChange && (
        <div style={TOGGLE_ROW_STYLE}>
          <div>
            <div style={{ fontSize: "13px" }}>{t("behaviorTab.behaviorTab.k9")}</div>
            <div style={DESCRIPTION_STYLE}>{t("behaviorTab.behaviorTab.k10")}</div>
          </div>
          <label className="cc-toggle-switch">
            <input type="checkbox" checked={newSessionConfirmEnabled} onChange={e => onNewSessionConfirmEnabledChange(e.target.checked)} />
            <span className="cc-toggle-slider" />
          </label>
        </div>
      )}

      {/* 声音通知 */}
      {soundNotificationEnabled !== undefined && onSoundNotificationEnabledChange && (
        <div style={TOGGLE_ROW_STYLE}>
          <div>
            <div style={{ fontSize: "13px" }}>{t("behaviorTab.behaviorTab.k11")}</div>
            <div style={DESCRIPTION_STYLE}>{t("behaviorTab.behaviorTab.k12")}</div>
          </div>
          <label className="cc-toggle-switch">
            <input type="checkbox" checked={soundNotificationEnabled} onChange={e => onSoundNotificationEnabledChange(e.target.checked)} />
            <span className="cc-toggle-slider" />
          </label>
        </div>
      )}

      {/* 仅失焦时通知 */}
      {soundOnlyWhenUnfocused !== undefined && onSoundOnlyWhenUnfocusedChange && (
        <div style={TOGGLE_ROW_STYLE}>
          <div>
            <div style={{ fontSize: "13px" }}>{t("behaviorTab.behaviorTab.k13")}</div>
            <div style={DESCRIPTION_STYLE}>{t("behaviorTab.behaviorTab.k14")}</div>
          </div>
          <label className="cc-toggle-switch">
            <input type="checkbox" checked={soundOnlyWhenUnfocused} onChange={e => onSoundOnlyWhenUnfocusedChange(e.target.checked)} />
            <span className="cc-toggle-slider" />
          </label>
        </div>
      )}

      {/* AI 提交信息生成 */}
      {commitGenerationEnabled !== undefined && onCommitGenerationEnabledChange && (
        <div style={TOGGLE_ROW_STYLE}>
          <div>
            <div style={{ fontSize: "13px" }}>{t("behaviorTab.behaviorTab.k15")}</div>
            <div style={DESCRIPTION_STYLE}>{t("behaviorTab.behaviorTab.k16")}</div>
          </div>
          <label className="cc-toggle-switch">
            <input type="checkbox" checked={commitGenerationEnabled} onChange={e => onCommitGenerationEnabledChange(e.target.checked)} />
            <span className="cc-toggle-slider" />
          </label>
        </div>
      )}

      {/* AI 标题生成 */}
      {aiTitleGenerationEnabled !== undefined && onAiTitleGenerationEnabledChange && (
        <div style={TOGGLE_ROW_STYLE}>
          <div>
            <div style={{ fontSize: "13px" }}>{t("behaviorTab.behaviorTab.k17")}</div>
            <div style={DESCRIPTION_STYLE}>{t("behaviorTab.behaviorTab.k18")}</div>
          </div>
          <label className="cc-toggle-switch">
            <input type="checkbox" checked={aiTitleGenerationEnabled} onChange={e => onAiTitleGenerationEnabledChange(e.target.checked)} />
            <span className="cc-toggle-slider" />
          </label>
        </div>
      )}

      {/* 状态栏小组件 */}
      {statusBarWidgetEnabled !== undefined && onStatusBarWidgetEnabledChange && (
        <div style={TOGGLE_ROW_STYLE}>
          <div>
            <div style={{ fontSize: "13px" }}>{t("behaviorTab.behaviorTab.k19")}</div>
            <div style={DESCRIPTION_STYLE}>{t("behaviorTab.behaviorTab.k20")}</div>
          </div>
          <label className="cc-toggle-switch">
            <input type="checkbox" checked={statusBarWidgetEnabled} onChange={e => onStatusBarWidgetEnabledChange(e.target.checked)} />
            <span className="cc-toggle-slider" />
          </label>
        </div>
      )}

      {/* 任务完成通知 */}
      {taskCompletionNotificationEnabled !== undefined && onTaskCompletionNotificationEnabledChange && (
        <div style={TOGGLE_ROW_STYLE}>
          <div>
            <div style={{ fontSize: "13px" }}>{t("behaviorTab.behaviorTab.k21")}</div>
            <div style={DESCRIPTION_STYLE}>{t("behaviorTab.behaviorTab.k22")}</div>
          </div>
          <label className="cc-toggle-switch">
            <input type="checkbox" checked={taskCompletionNotificationEnabled} onChange={e => onTaskCompletionNotificationEnabledChange(e.target.checked)} />
            <span className="cc-toggle-slider" />
          </label>
        </div>
      )}

      {/* 权限弹窗超时 */}
      {permissionDialogTimeoutSeconds !== undefined && onPermissionDialogTimeoutChange && (
        <div style={FORM_ROW_STYLE}>
          <label style={LABEL_STYLE}>{t("behaviorTab.behaviorTab.k23")}</label>
          <div style={VALUE_CONTAINER_STYLE}>
            <select
              style={SELECT_STYLE}
              value={permissionDialogTimeoutSeconds}
              onChange={e => onPermissionDialogTimeoutChange(Number(e.target.value))}
            >
              <option value={0}>{t("behaviorTab.behaviorTab.k24")}</option>
              <option value={60}>{t("behaviorTab.behaviorTab.k25")}</option>
              <option value={120}>{t("behaviorTab.behaviorTab.k26")}</option>
              <option value={180}>{t("behaviorTab.behaviorTab.k27")}</option>
              <option value={300}>{t("behaviorTab.behaviorTab.k28")}</option>
            </select>
            <div style={DESCRIPTION_STYLE}>{t("behaviorTab.behaviorTab.k29")}</div>
          </div>
        </div>
      )}
    </div>
  );
}
