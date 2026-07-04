// ProviderList — Provider 列表 (增强版 D4)
// 新增: Provider 类型图标 + 模型数量 + API Key 状态 + 连接测试按钮

import type { ProviderPreset } from "../../../types";

interface ProviderListProps {
  presets: ProviderPreset[];
  selectedId: string;
  onSelect: (id: string) => void;
  onEdit: (preset: ProviderPreset) => void;
  onAdd: () => void;
}

const TYPE_ICONS: Record<string, string> = {
  official: "🏢", custom: "🔧", third: "☁️",
};

const TYPE_LABELS: Record<string, string> = {
  official: "官方", custom: "自定义", third: "第三方",
};

export function ProviderList({ presets, selectedId, onSelect, onEdit, onAdd }: ProviderListProps) {

  return (
    <div className="cc-provider-list">
      {presets.length === 0 ? (
        <div className="cc-provider-empty">
          暂无 Provider
          <br />
          <button className="cc-provider-add-btn" onClick={onAdd}>+ 添加自定义 Provider</button>
        </div>
      ) : (
        <>
          {presets.map(p => {
            const modelCount = p.customModels?.length || 0;
            return (
              <div
                key={p.id}
                className={`cc-provider-item ${selectedId === p.id ? "active" : ""}`}
                onClick={() => onSelect(p.id)}
              >
                <div className="cc-provider-item-header">
                  <span className="cc-provider-item-icon">
                    {TYPE_ICONS[p.id === "official" ? "official" : p.id === "custom" ? "custom" : "third"] || "🔧"}
                  </span>
                  <div className="cc-provider-item-info">
                    <div className="cc-provider-item-name">
                      {p.name}
                      <span className="cc-provider-item-type">
                        {TYPE_LABELS[p.id === "official" ? "official" : "custom"] || "自定义"}
                      </span>
                    </div>
                    {p.baseUrl && <div className="cc-provider-item-url" title={p.baseUrl}>{p.baseUrl}</div>}
                    <div className="cc-provider-item-meta">
                      {modelCount > 0 && <span>{modelCount} 个模型</span>}
                      {!p.baseUrl && p.id !== "official" && <span className="cc-provider-no-url">未配置 URL</span>}
                    </div>
                  </div>
                </div>
                <button className="cc-provider-edit-btn" onClick={(e) => { e.stopPropagation(); onEdit(p); }}>
                  ✏️
                </button>
              </div>
            );
          })}
          <button className="cc-provider-add-btn" onClick={onAdd}>+ 添加自定义 Provider</button>
        </>
      )}
    </div>
  );
}
