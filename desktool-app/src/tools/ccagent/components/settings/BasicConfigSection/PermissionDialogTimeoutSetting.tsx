// PermissionDialogTimeoutSetting.tsx — B5-2: 权限弹窗超时设置
// 对齐 cc-gui PermissionDialogTimeoutSetting.tsx (66行)

import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface PermissionDialogTimeoutSettingProps {
  /** 当前超时值 (秒), 0=不超时 */
  value?: number;
  onChange?: (seconds: number) => void;
  disabled?: boolean;
}

const PRESETS = [
  { label: "永不超时", value: 0 },
  { label: "30 秒", value: 30 },
  { label: "1 分钟", value: 60 },
  { label: "2 分钟", value: 120 },
  { label: "5 分钟", value: 300 },
  { label: "10 分钟", value: 600 },
];

export function PermissionDialogTimeoutSetting({
  value = 0,
  onChange,
  disabled = false,
}: PermissionDialogTimeoutSettingProps) {
  const [timeout, setTimeout] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTimeout(value);
  }, [value]);

  const handleChange = useCallback(
    async (newValue: number) => {
      setTimeout(newValue);
      onChange?.(newValue);

      // 持久化到后端
      setSaving(true);
      try {
        await invoke("cc_set_permission_dialog_timeout", {
          timeoutSeconds: newValue,
        });
      } catch {
        // 静默失败，本地状态已更新
      }
      setSaving(false);
    },
    [onChange],
  );

  const customValue = !PRESETS.find((p) => p.value === timeout);

  return (
    <div className="cc-settings-row">
      <div className="cc-settings-label">
        <span className="cc-settings-label-text">权限弹窗超时</span>
        <span className="cc-settings-label-desc">
          权限请求弹窗超过设定时间未响应则自动拒绝
        </span>
      </div>
      <div className="cc-settings-control">
        <div className="cc-timeout-presets">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              className={`cc-timeout-btn ${timeout === p.value ? "cc-active" : ""}`}
              disabled={disabled || saving}
              onClick={() => handleChange(p.value)}
            >
              {p.label}
            </button>
          ))}
          {customValue && timeout > 0 && (
            <button className="cc-timeout-btn cc-active" disabled>
              {timeout} 秒
            </button>
          )}
        </div>
        <div className="cc-timeout-custom">
          <span>自定义:</span>
          <input
            type="number"
            min={0}
            max={3600}
            value={timeout}
            disabled={disabled || saving}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10) || 0;
              handleChange(Math.max(0, Math.min(3600, v)));
            }}
            className="cc-timeout-input"
          />
          <span>秒</span>
          {saving && <span className="cc-saving-indicator">保存中...</span>}
        </div>
      </div>
    </div>
  );
}
