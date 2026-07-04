// EnvVarEditor — 环境变量编辑器
// 对齐 cc-gui 的 EnvVarEditor/index.tsx
// 用于 CodexProviderDialog 中的 messageEnvVars / mcpEnvVars 编辑

import { useState, useCallback, useEffect, useRef } from "react";
import type { EnvVarEntry } from "../../types";
import {
  isValidEnvVarKey,
  isProtectedEnvVarKey,
  ENV_VAR_VALUE_MAX_LENGTH,
} from "../../types";
import { TrashIcon, AddIcon } from "../Icons";

interface EnvVarEditorProps {
  /** 当前环境变量条目 */
  entries: EnvVarEntry[];
  /** 条目变化回调 */
  onChange: (entries: EnvVarEntry[]) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

interface ValidationErrors {
  [key: string]: string;
}

export default function EnvVarEditor({ entries, onChange, disabled }: EnvVarEditorProps) {
  const [errors, setErrors] = useState<ValidationErrors>({});

  // 稳定的 React key，避免用数组索引作 key 导致删除时焦点丢失
  const nextIdRef = useRef(0);
  const [rowIds, setRowIds] = useState<string[]>(() =>
    entries.map(() => `env-${nextIdRef.current++}`),
  );

  // 外部 entries 长度变化时同步 rowIds
  useEffect(() => {
    setRowIds(prev => {
      if (prev.length === entries.length) return prev;
      const next = [...prev];
      while (next.length < entries.length) {
        next.push(`env-${nextIdRef.current++}`);
      }
      if (next.length > entries.length) {
        next.length = entries.length;
      }
      return next;
    });
  }, [entries.length]);

  const validateEntries = useCallback((newEntries: EnvVarEntry[]): ValidationErrors => {
    const newErrors: ValidationErrors = {};
    const seenKeys = new Set<string>();
    newEntries.forEach((entry, index) => {
      const key = entry.key.trim();
      const upperKey = key.toUpperCase();
      // 值长度校验
      if (entry.value.length > ENV_VAR_VALUE_MAX_LENGTH) {
        newErrors[`${index}-value-length`] = `环境变量值过长（上限 ${ENV_VAR_VALUE_MAX_LENGTH} 字符）`;
      }
      if (!key) return; // 空 key 允许，保存时过滤
      if (!isValidEnvVarKey(key)) {
        newErrors[`${index}-key-format`] = "环境变量名格式无效（需以字母/下划线开头）";
        return;
      }
      if (isProtectedEnvVarKey(key)) {
        newErrors[`${index}-key-protected`] = `环境变量 ${key} 受保护，不可覆盖`;
        return;
      }
      if (seenKeys.has(upperKey)) {
        newErrors[`${index}-key-duplicate`] = `环境变量 ${key} 重复`;
        return;
      }
      seenKeys.add(upperKey);
    });
    return newErrors;
  }, []);

  const handleKeyChange = useCallback((index: number, newKey: string) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], key: newKey };
    onChange(newEntries);
    setErrors(validateEntries(newEntries));
  }, [entries, onChange, validateEntries]);

  const handleValueChange = useCallback((index: number, newValue: string) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], value: newValue };
    onChange(newEntries);
    setErrors(validateEntries(newEntries));
  }, [entries, onChange, validateEntries]);

  const handleDelete = useCallback((index: number) => {
    const newEntries = entries.filter((_, i) => i !== index);
    onChange(newEntries);
    setRowIds(prev => prev.filter((_, i) => i !== index));
    setErrors(validateEntries(newEntries));
  }, [entries, onChange, validateEntries]);

  const handleAdd = useCallback(() => {
    const newEntries = [...entries, { key: "", value: "" }];
    onChange(newEntries);
    setRowIds(prev => [...prev, `env-${nextIdRef.current++}`]);
  }, [entries, onChange]);

  const handleBlur = useCallback(() => {
    setErrors(validateEntries(entries));
  }, [entries, validateEntries]);

  return (
    <div className="cc-env-var-editor">
      {entries.length === 0 ? (
        <div className="cc-env-var-empty">暂无环境变量</div>
      ) : (
        <div className="cc-env-var-list">
          {entries.map((entry, index) => {
            const rowId = rowIds[index] ?? `env-fallback-${index}`;
            return (
              <div key={rowId} className="cc-env-var-item">
                <input
                  type="text"
                  className="cc-env-var-key-input"
                  value={entry.key}
                  onChange={e => handleKeyChange(index, e.target.value)}
                  onBlur={handleBlur}
                  placeholder="变量名"
                  disabled={disabled}
                  maxLength={256}
                />
                <input
                  type="text"
                  className="cc-env-var-value-input"
                  value={entry.value}
                  onChange={e => handleValueChange(index, e.target.value)}
                  placeholder="变量值"
                  disabled={disabled}
                  maxLength={ENV_VAR_VALUE_MAX_LENGTH}
                />
                <button
                  type="button"
                  className="cc-env-var-delete-btn"
                  onClick={() => handleDelete(index)}
                  disabled={disabled}
                  title="删除"
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {Object.keys(errors).length > 0 && (
        <div className="cc-env-var-error">{Object.values(errors)[0]}</div>
      )}
      <button
        type="button"
        className="cc-env-var-add-btn"
        onClick={handleAdd}
        disabled={disabled}
      >
        <AddIcon size={14} />
        添加环境变量
      </button>
    </div>
  );
}
