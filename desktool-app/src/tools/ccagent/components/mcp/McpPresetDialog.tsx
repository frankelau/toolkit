// McpPresetDialog — MCP 预设选择弹窗
// Sprint C: 一键添加常用 MCP 服务器

import { useState } from "react";
import { MCP_PRESETS } from "./utils/presets";
import type { McpServer, McpPreset } from "./types";
import { generateServerId } from "./utils";

interface McpPresetDialogProps {
  isOpen: boolean;
  onAdd: (server: McpServer) => void;
  onClose: () => void;
}

export function McpPresetDialog({ isOpen, onAdd, onClose }: McpPresetDialogProps) {
  const [selected, setSelected] = useState<string | null>(null);

  if (!isOpen) return null;

  function add() {
    const preset = MCP_PRESETS.find(p => p.name === selected);
    if (!preset) return;
    onAdd({
      id: generateServerId(preset.name),
      name: preset.name,
      server: {
        type: "stdio",
        command: preset.command,
        args: preset.args,
        env: preset.env,
      },
      enabled: true,
    });
    setSelected(null);
    onClose();
  }

  return (
    <div className="cc-mcp-dialog-overlay" onClick={onClose}>
      <div className="cc-mcp-dialog cc-mcp-preset-dialog" onClick={e => e.stopPropagation()}>
        <div className="cc-mcp-dialog-title">从预设添加</div>
        <div className="cc-mcp-preset-list">
          {MCP_PRESETS.map((p: McpPreset) => (
            <label
              key={p.name}
              className={`cc-mcp-preset-item ${selected === p.name ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="preset"
                checked={selected === p.name}
                onChange={() => setSelected(p.name)}
              />
              <div className="cc-mcp-preset-info">
                <div className="cc-mcp-preset-name">{p.name}</div>
                <div className="cc-mcp-preset-desc">{p.description}</div>
              </div>
            </label>
          ))}
        </div>
        <div className="cc-mcp-dialog-actions">
          <button className="cc-mcp-cancel" onClick={onClose}>取消</button>
          <button className="cc-mcp-save" onClick={add} disabled={!selected}>添加</button>
        </div>
      </div>
    </div>
  );
}
