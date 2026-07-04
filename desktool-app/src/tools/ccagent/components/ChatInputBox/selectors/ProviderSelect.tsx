// ProviderSelect — Provider 选择器（对齐 cc-gui ProviderSelect）
// Sprint U1: 深化实现 — Codex 配额订阅 + Toast + 子菜单视口适配

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "../../../i18n";
import { ProviderModelIcon } from "../../shared/ProviderModelIcon";
import {
  fetchCodexSubscriptionQuota,
  subscribeCodexSubscriptionQuota,
  type CodexSubscriptionQuotaSnapshot,
} from "../../../utils/codexSubscriptionQuotaCapabilities";
import { sendBridgeEventQuiet } from "../../../utils/bridge";

// ─── 可用 Provider 列表 ─────────────────────────────────────────────────────

export interface AvailableProvider {
  id: string;
  label: string;
  enabled: boolean;
}

export const AVAILABLE_PROVIDERS: AvailableProvider[] = [
  { id: "claude", label: "Claude", enabled: true },
  { id: "codex", label: "Codex", enabled: true },
];

// ─── 样式常量 ────────────────────────────────────────────────────────────────

const RELATIVE_INLINE_BLOCK_STYLE: React.CSSProperties = { position: "relative", display: "inline-block" };
const CHEVRON_ICON_STYLE: React.CSSProperties = { fontSize: "10px", marginLeft: "2px" };

const DROPDOWN_STYLE: React.CSSProperties = {
  position: "absolute",
  bottom: "100%",
  left: 0,
  marginBottom: "4px",
  zIndex: 10000,
  minWidth: "180px",
  background: "var(--cc-bg-dropdown, #2b2b2b)",
  border: "1px solid var(--cc-border, #555)",
  borderRadius: "6px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
};

const TOAST_STYLE: React.CSSProperties = {
  position: "fixed",
  bottom: "60px",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 20000,
  padding: "8px 16px",
  background: "var(--cc-bg-toast, #333)",
  color: "var(--cc-text-primary, #fff)",
  borderRadius: "6px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
  fontSize: "13px",
  pointerEvents: "none",
};

const SUBMENU_MAX_WIDTH_PX = 360;
const SUBMENU_OVERLAP_PX = 30;
const SUBMENU_VIEWPORT_MARGIN_PX = 8;

const SUBMENU_STYLE: React.CSSProperties = {
  position: "absolute",
  left: "100%",
  bottom: 0,
  zIndex: 10001,
  minWidth: "300px",
  maxWidth: `${SUBMENU_MAX_WIDTH_PX}px`,
  background: "var(--cc-bg-dropdown, #2b2b2b)",
  border: "1px solid var(--cc-border, #555)",
  borderRadius: "6px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
};

const SUBMENU_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  alignItems: "flex-start",
};

const SUBMENU_SECTION_STYLE: React.CSSProperties = { padding: "6px 12px" };
const SUBMENU_DIVIDER_STYLE: React.CSSProperties = { height: "1px", background: "var(--cc-border, #555)" };

const OPTION_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 12px",
  cursor: "pointer",
};

function formatTokens(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Math.trunc(value).toLocaleString();
}

function getProviderOptionStyle(enabled: boolean): React.CSSProperties {
  return {
    opacity: enabled ? 1 : 0.5,
    cursor: enabled ? "pointer" : "not-allowed",
  };
}

// ─── 组件 ────────────────────────────────────────────────────────────────────

interface ProviderSelectProps {
  value: string;
  onChange?: (providerId: string) => void;
  /** compact 模式只显示图标 */
  compact?: boolean;
}

export function ProviderSelect({ value, onChange, compact = false }: ProviderSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [activeSubmenu, setActiveSubmenu] = useState<"none" | "codexQuota">("none");
  const [codexQuota, setCodexQuota] = useState<CodexSubscriptionQuotaSnapshot | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [submenuShiftX, setSubmenuShiftX] = useState(0);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<number | undefined>(undefined);

  const currentProvider = AVAILABLE_PROVIDERS.find(p => p.id === value) || AVAILABLE_PROVIDERS[0];

  const getProviderLabel = (providerId: string) => {
    const key = `providers.${providerId}.label`;
    const translated = t(key);
    return translated === key ? providerId : translated;
  };

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
    setActiveSubmenu("none");
  }, [isOpen]);

  const showToastMessage = useCallback((message: string) => {
    if (toastTimerRef.current !== undefined) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    setShowToast(true);
    toastTimerRef.current = window.setTimeout(() => setShowToast(false), 1500);
  }, []);

  const requestCodexQuota = useCallback(() => {
    setQuotaLoading(true);
    fetchCodexSubscriptionQuota();
  }, []);

  // 订阅 Codex 配额快照
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    subscribeCodexSubscriptionQuota((snapshot) => {
      setCodexQuota(snapshot);
      setQuotaLoading(false);
    }).then((un) => { unsubscribe = un; });
    return () => { unsubscribe?.(); };
  }, []);

  const handleSelect = useCallback((providerId: string) => {
    const provider = AVAILABLE_PROVIDERS.find(p => p.id === providerId);
    if (!provider) return;

    if (!provider.enabled) {
      showToastMessage(t("settings.provider.featureComingSoon"));
      setIsOpen(false);
      return;
    }

    onChange?.(providerId);
    sendBridgeEventQuiet("set_provider", providerId);
    showToastMessage(t("config.provider.switched", { provider: getProviderLabel(providerId) }));
    setIsOpen(false);
  }, [onChange, showToastMessage]);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // 打开 Codex 配额子菜单时请求
  useEffect(() => {
    if (!isOpen || activeSubmenu !== "codexQuota") return;
    requestCodexQuota();
  }, [activeSubmenu, isOpen, requestCodexQuota]);

  // 清理 toast 定时器
  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== undefined) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const renderCodexQuotaSubmenu = () => {
    const fiveHour = codexQuota?.windows.fiveHour;
    const weekly = codexQuota?.windows.weekly;
    const isApiKeyMode = codexQuota?.reasonCode === "api_key_mode";

    const renderWindowRow = (
      label: string,
      window: CodexSubscriptionQuotaSnapshot["windows"]["fiveHour"] | undefined,
      isLast: boolean,
    ) => {
      const hasLimit = typeof window?.limitTokens === "number" && Number.isFinite(window.limitTokens);
      const hasRemaining = typeof window?.remainingTokens === "number" && Number.isFinite(window.remainingTokens);
      const limitTokens = typeof window?.limitTokens === "number" ? window.limitTokens : undefined;
      const remainingTokens = typeof window?.remainingTokens === "number" ? window.remainingTokens : undefined;
      const remainingPercentFromApi = typeof window?.remainingPercent === "number" && Number.isFinite(window.remainingPercent)
        ? window.remainingPercent
        : null;
      const remainingPercent = remainingPercentFromApi !== null
        ? Math.max(0, Math.min(100, Math.round(remainingPercentFromApi)))
        : hasLimit && hasRemaining && (limitTokens ?? 0) > 0
          ? Math.max(0, Math.min(100, Math.round(((remainingTokens ?? 0) / (limitTokens ?? 1)) * 100)))
          : null;
      const hasUsedTokens = typeof window?.usedTokens === "number" && Number.isFinite(window.usedTokens) && window.usedTokens > 0;
      const resetsAt = typeof window?.resetsAt === "number" && Number.isFinite(window.resetsAt)
        ? new Date(window.resetsAt).toLocaleString()
        : null;

      return (
        <div style={SUBMENU_SECTION_STYLE}>
          <div className="selector-option" style={{ ...SUBMENU_ROW_STYLE, ...OPTION_STYLE }}>
            <span>{label}</span>
            <span style={{ fontSize: "11px", opacity: 0.7 }}>
              {window
                ? remainingPercent !== null
                  ? resetsAt
                    ? t("config.codexQuota.windowRemainingPercentWithReset", { percent: remainingPercent, value: resetsAt })
                    : t("config.codexQuota.windowRemainingPercent", { percent: remainingPercent })
                  : hasUsedTokens
                    ? t("config.codexQuota.windowUsedOnly", { used: formatTokens(window.usedTokens) })
                    : t("config.codexQuota.windowUnavailable")
                : t("config.codexQuota.windowUnavailable")}
            </span>
          </div>
          {!isLast && <div style={SUBMENU_DIVIDER_STYLE} />}
        </div>
      );
    };

    return (
      <div
        className="selector-dropdown"
        style={{ ...SUBMENU_STYLE, marginLeft: `${-SUBMENU_OVERLAP_PX - submenuShiftX}px` }}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={(e) => {
          e.stopPropagation();
          setActiveSubmenu("codexQuota");
        }}
      >
        <div className="selector-option" style={{ ...OPTION_STYLE, cursor: "default" }}>
          <span>📊</span>
          <div style={SUBMENU_ROW_STYLE}>
            <span>{t("config.codexQuota.title")}</span>
            <span style={{ fontSize: "11px", opacity: 0.7 }}>
              {isApiKeyMode
                ? t("config.codexQuota.apiKeyMode")
                : codexQuota?.status === "ok"
                  ? t("config.codexQuota.lastUpdated", { value: new Date(codexQuota.fetchedAt).toLocaleString() })
                  : quotaLoading
                    ? t("config.codexQuota.loading")
                    : t("config.codexQuota.unavailable")}
            </span>
          </div>
        </div>
        {!isApiKeyMode && (
          <>
            <div style={SUBMENU_DIVIDER_STYLE} />
            {renderWindowRow(t("config.codexQuota.fiveHour"), fiveHour, false)}
            {renderWindowRow(t("config.codexQuota.weekly"), weekly, true)}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div style={RELATIVE_INLINE_BLOCK_STYLE}>
        <button
          ref={buttonRef}
          className={`selector-button${compact ? " provider-compact" : ""}`}
          onClick={handleToggle}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "2px 6px",
            borderRadius: "4px",
            color: "var(--cc-text-secondary, #888)",
          }}
          title={`${t("config.switchProvider")}: ${getProviderLabel(currentProvider.id)}`}
        >
          <ProviderModelIcon providerId={currentProvider.id} size={compact ? 16 : 12} colored={compact} />
          {!compact && (
            <>
              <span>{getProviderLabel(currentProvider.id)}</span>
              <span style={CHEVRON_ICON_STYLE}>{isOpen ? "▲" : "▼"}</span>
            </>
          )}
        </button>

        {isOpen && (
          <div ref={dropdownRef} className="selector-dropdown" style={DROPDOWN_STYLE}>
            {AVAILABLE_PROVIDERS.map((provider) => (
              <div
                key={provider.id}
                className={`selector-option ${provider.id === value ? "selected" : ""} ${!provider.enabled ? "disabled" : ""}`}
                onClick={() => handleSelect(provider.id)}
                style={{
                  ...OPTION_STYLE,
                  ...getProviderOptionStyle(!!provider.enabled),
                  ...(provider.id === "codex" ? { position: "relative" } : {}),
                }}
                onMouseEnter={(e) => {
                  if (provider.id === "codex") {
                    // 子菜单视口适配
                    const rect = e.currentTarget.getBoundingClientRect();
                    const overflow = rect.right - SUBMENU_OVERLAP_PX + SUBMENU_MAX_WIDTH_PX
                      - (window.innerWidth - SUBMENU_VIEWPORT_MARGIN_PX);
                    setSubmenuShiftX(overflow > 0 ? Math.round(overflow) : 0);
                    setActiveSubmenu("codexQuota");
                  } else {
                    setActiveSubmenu("none");
                  }
                }}
                onMouseLeave={() => {
                  if (provider.id === "codex") {
                    setActiveSubmenu("none");
                  }
                }}
              >
                <ProviderModelIcon providerId={provider.id} size={16} colored />
                <span>{getProviderLabel(provider.id)}</span>
                {provider.id === value && <span>✓</span>}
                {provider.id === "codex" && (
                  <span style={{ fontSize: "10px", marginLeft: provider.id === value ? "2px" : "auto" }}>›</span>
                )}
                {provider.id === "codex" && activeSubmenu === "codexQuota" && renderCodexQuotaSubmenu()}
              </div>
            ))}
          </div>
        )}
      </div>

      {showToast && createPortal(
        <div className="selector-toast" style={TOAST_STYLE}>
          {toastMessage}
        </div>,
        document.body,
      )}
    </>
  );
}
