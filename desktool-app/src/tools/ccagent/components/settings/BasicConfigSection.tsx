// BasicConfigSection — 基础配置（对齐 cc-gui BasicConfigSection）
// Sprint D: 引擎/模型/权限/流式/思考/行为/外观/环境变量

import type { Engine, EngineInfo } from "../../types";
import { MODELS, EFFORT_LEVELS, PERMISSION_MODES } from "../../constants";
import { useLocale } from "../../hooks/useLocale";

interface BasicConfigSectionProps {
  engine: Engine;
  setEngine: (e: Engine) => void;
  engines: Record<Engine, EngineInfo | null>;
  model: string;
  setModel: (m: string) => void;
  effort: string;
  setEffort: (e: string) => void;
  permissionMode: string;
  setPermissionMode: (m: string) => void;
  streamingEnabled: boolean;
  setStreamingEnabled: (v: boolean) => void;
  thinkingEnabled: boolean;
  setThinkingEnabled: (v: boolean) => void;
  sendShortcut: "enter" | "cmdEnter";
  setSendShortcut: (v: "enter" | "cmdEnter") => void;
  autoOpenFile: boolean;
  setAutoOpenFile: (v: boolean) => void;
  permissionDialogTimeout: number;
  setPermissionDialogTimeout: (v: number) => void;
}

export function BasicConfigSection(props: BasicConfigSectionProps) {
  const { t } = useLocale();
  return (
    <div className="cc-settings-block">
      <div className="cc-settings-block-title">{t("basicConfig.basicConfig.k1")}</div>

      {/* 引擎 */}
      <div className="cc-setting-row">
        <label>{t("basicConfig.basicConfig.k2")}</label>
        <select value={props.engine} onChange={e => props.setEngine(e.target.value as Engine)}>
          <option value="claude" disabled={!props.engines.claude}>
            Claude Code {props.engines.claude ? `(${props.engines.claude.version})` : "(未安装)"}
          </option>
          <option value="codex" disabled={!props.engines.codex}>
            Codex {props.engines.codex ? `(${props.engines.codex.version})` : "(未安装)"}
          </option>
        </select>
      </div>

      {/* 模型 */}
      <div className="cc-setting-row">
        <label>{t("basicConfig.basicConfig.k3")}</label>
        <select value={props.model} onChange={e => props.setModel(e.target.value)}>
          {(MODELS[props.engine] || []).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {/* 推理力度 */}
      {props.engine === "claude" && (
        <div className="cc-setting-row">
          <label>{t("basicConfig.basicConfig.k4")}</label>
          <select value={props.effort} onChange={e => props.setEffort(e.target.value)}>
            <option value="">{t("basicConfig.basicConfig.k5")}</option>
            {EFFORT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      )}

      {/* 权限模式 */}
      <div className="cc-setting-row">
        <label>{t("basicConfig.basicConfig.k6")}</label>
        <select value={props.permissionMode} onChange={e => props.setPermissionMode(e.target.value)}>
          {PERMISSION_MODES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {/* 1M 上下文 */}
      <div className="cc-setting-row">
        <label>{t("basicConfig.basicConfig.k7")}</label>
        <select
          value={props.model.includes("[1m]") ? "1" : "0"}
          onChange={e => {
            if (e.target.value === "1" && !props.model.includes("[1m]")) props.setModel(props.model + "[1m]");
            else if (e.target.value === "0") props.setModel(props.model.replace("[1m]", ""));
          }}
        >
          <option value="0">{t("basicConfig.basicConfig.k8")}</option>
          <option value="1">{t("basicConfig.basicConfig.k9")}</option>
        </select>
      </div>

      {/* 流式开关 */}
      <div className="cc-setting-row">
        <label>{t("basicConfig.basicConfig.k10")}</label>
        <label className="cc-toggle-switch">
          <input type="checkbox" checked={props.streamingEnabled} onChange={e => props.setStreamingEnabled(e.target.checked)} />
          <span className="cc-toggle-slider"></span>
          <span className="cc-toggle-label">{props.streamingEnabled ? "开启" : "关闭"}</span>
        </label>
      </div>

      {/* 思考开关 */}
      {props.engine === "claude" && (
        <div className="cc-setting-row">
          <label>{t("basicConfig.basicConfig.k11")}</label>
          <label className="cc-toggle-switch">
            <input type="checkbox" checked={props.thinkingEnabled} onChange={e => props.setThinkingEnabled(e.target.checked)} />
            <span className="cc-toggle-slider"></span>
            <span className="cc-toggle-label">{props.thinkingEnabled ? "开启" : "按需"}</span>
          </label>
        </div>
      )}

      {/* 发送快捷键 */}
      <div className="cc-setting-row">
        <label>{t("basicConfig.basicConfig.k12")}</label>
        <select value={props.sendShortcut} onChange={e => props.setSendShortcut(e.target.value as "enter" | "cmdEnter")}>
          <option value="enter">{t("basicConfig.basicConfig.k13")}</option>
          <option value="cmdEnter">{t("basicConfig.basicConfig.k14")}</option>
        </select>
      </div>

      {/* 自动打开文件 */}
      <div className="cc-setting-row">
        <label>{t("basicConfig.basicConfig.k15")}</label>
        <label className="cc-toggle-switch">
          <input type="checkbox" checked={props.autoOpenFile} onChange={e => props.setAutoOpenFile(e.target.checked)} />
          <span className="cc-toggle-slider"></span>
          <span className="cc-toggle-label">{props.autoOpenFile ? "开启" : "关闭"}</span>
        </label>
      </div>

      {/* 权限弹窗超时 */}
      <div className="cc-setting-row">
        <label>{t("basicConfig.basicConfig.k16")}</label>
        <input
          type="number"
          min={10}
          max={300}
          value={props.permissionDialogTimeout}
          onChange={e => props.setPermissionDialogTimeout(Number(e.target.value))}
          style={{ width: 80 }}
        />
      </div>
    </div>
  );
}
