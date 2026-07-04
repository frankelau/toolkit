// RuntimeProviderSelect.tsx — 运行时 Provider 切换器
// 对齐 cc-gui ChatInputBox/selectors/RuntimeProviderSelect.tsx
// 适配：用 Tauri invoke + listen 替代 bridge 事件；简化版
// TODO: 后端需补 cc_get_providers / cc_switch_provider 命令（Sprint S）

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { t } from "../../../i18n";

/** 运行时 Provider 配置（Claude / Codex 通用） */
export interface RuntimeProviderConfig {
  id: string;
  name: string;
  isActive?: boolean;
  remark?: string;
  websiteUrl?: string;
}

export interface RuntimeProviderSelectProps {
  currentProvider: string;
  embedded?: boolean;
  onClose?: () => void;
  onProviderSwitched?: (providerName: string) => void;
}

type ProviderKind = "claude" | "codex";

const isProviderKind = (provider: string): provider is ProviderKind =>
  provider === "claude" || provider === "codex";

const DISABLED_OPTION_STYLE: CSSProperties = { cursor: "default" };
const PROVIDER_INFO_STYLE: CSSProperties = { display: "flex", flexDirection: "column", minWidth: 0, flex: 1 };
const RELATIVE_INLINE_BLOCK_STYLE: CSSProperties = { position: "relative", display: "inline-block" };
const CHEVRON_ICON_STYLE: CSSProperties = { fontSize: "10px", marginLeft: "2px" };

/**
 * RuntimeProviderSelect — 运行时活跃 Provider 切换
 * Claude 模式切换 Claude Code Provider；Codex 模式切换 Codex Provider。
 *
 * NOTE: 依赖后端命令 cc_get_providers / cc_switch_provider。
 *       命令未实现时显示空状态，不影响编译和运行。
 */
export function RuntimeProviderSelect({
  currentProvider, embedded = false, onClose, onProviderSwitched,
}: RuntimeProviderSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<RuntimeProviderConfig[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const providerKind: ProviderKind = currentProvider === "codex" ? "codex" : "claude";
  const activeProvider = useMemo(
    () => providers.find(p => p.isActive),
    [providers],
  );

  const getProviderDisplayName = useCallback((provider: RuntimeProviderConfig) => {
    return provider.name || provider.id;
  }, []);

  const requestProviders = useCallback(async () => {
    setLoading(true);
    try {
      const cmd = providerKind === "codex" ? "cc_get_codex_providers" : "cc_get_providers";
      const data = await invoke<RuntimeProviderConfig[]>(cmd).catch(() => [] as RuntimeProviderConfig[]);
      setProviders(data);
    } catch {
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, [providerKind]);

  const handleToggle = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isProviderKind(currentProvider)) return;
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) requestProviders();
  }, [currentProvider, isOpen, requestProviders]);

  const handleSelect = useCallback(async (provider: RuntimeProviderConfig) => {
    const cmd = providerKind === "codex" ? "cc_switch_codex_provider" : "cc_switch_provider";
    try {
      await invoke(cmd, { id: provider.id });
    } catch { /* 命令可能未实现 */ }
    onProviderSwitched?.(getProviderDisplayName(provider));
    setProviders(prev => prev.map(item => ({ ...item, isActive: item.id === provider.id })));
    setIsOpen(false);
    onClose?.();
  }, [getProviderDisplayName, onClose, onProviderSwitched, providerKind]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handleClickOutside), 0);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handleClickOutside); };
  }, [isOpen]);

  useEffect(() => {
    if (!embedded) return;
    requestProviders();
  }, [embedded, requestProviders]);

  if (!isProviderKind(currentProvider)) return null;

  const activeName = activeProvider ? getProviderDisplayName(activeProvider) : (t("config.runtimeProvider.title") || "Provider");

  const dropdownStyle: CSSProperties = {
    position: "absolute",
    bottom: embedded ? 0 : "100%",
    left: embedded ? "100%" : 0,
    marginLeft: embedded ? "-30px" : undefined,
    marginBottom: embedded ? undefined : "4px",
    zIndex: 10001, minWidth: "260px", maxWidth: "360px",
    maxHeight: "300px", overflowY: "auto",
  };

  const renderProviderDropdown = () => (
    <div
      ref={dropdownRef}
      role="listbox"
      className="selector-dropdown runtime-provider-dropdown"
      style={dropdownStyle}
      onMouseEnter={(event) => event.stopPropagation()}
    >
      {loading && providers.length === 0 ? (
        <div className="selector-option disabled" style={DISABLED_OPTION_STYLE}>
          <span className="codicon codicon-loading codicon-modifier-spin" />
          <span>{t("config.runtimeProvider.loading") || "加载中..."}</span>
        </div>
      ) : providers.length === 0 ? (
        <div className="selector-option disabled" style={DISABLED_OPTION_STYLE}>
          <span className="codicon codicon-info" />
          <span>{t("config.runtimeProvider.empty") || "暂无可用 Provider"}</span>
        </div>
      ) : (
        providers.map((provider) => {
          const selected = !!provider.isActive;
          const description = provider.remark || provider.websiteUrl;
          return (
            <div
              key={provider.id}
              className={`selector-option ${selected ? "selected" : ""}`}
              onClick={() => handleSelect(provider)}
              title={description || getProviderDisplayName(provider)}
            >
              <span className="codicon codicon-key" />
              <div style={PROVIDER_INFO_STYLE}>
                <span className="runtime-provider-name">{getProviderDisplayName(provider)}</span>
                {description ? <span className="model-description">{description}</span> : null}
              </div>
              {selected && <span className="codicon codicon-check check-mark" />}
            </div>
          );
        })
      )}
    </div>
  );

  if (embedded) return renderProviderDropdown();

  return (
    <div style={RELATIVE_INLINE_BLOCK_STYLE}>
      <button
        ref={buttonRef}
        type="button"
        className="selector-button runtime-provider-button"
        onClick={handleToggle}
        aria-label={t("config.runtimeProvider.title") || "Provider"}
        title={`${t("config.runtimeProvider.title") || "Provider"}: ${activeName}`}
      >
        <span className="codicon codicon-vm-connect" />
        <span className="selector-button-text runtime-provider-text">{activeName}</span>
        <span className={`codicon codicon-chevron-${isOpen ? "up" : "down"}`} style={CHEVRON_ICON_STYLE} />
      </button>
      {isOpen && renderProviderDropdown()}
    </div>
  );
}

export default RuntimeProviderSelect;
