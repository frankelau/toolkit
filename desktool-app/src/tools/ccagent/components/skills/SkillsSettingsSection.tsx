// SkillsSettingsSection — 技能管理设置区（创建/删除/查看 + 搜索 + 启用/禁用）
// D6增强: 技能搜索过滤 + 开关启用/禁用

import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "../../../../useCopyFeedback";
import { enableSkill, disableSkill, importSkill } from "../../utils/backendCommands";
import type { SkillDef } from "../../types";
import { FileIcon } from "../common";

export interface SkillsSettingsSectionProps {
  skills: SkillDef[];
  onRefresh: () => void;
}

export function SkillsSettingsSection(props: SkillsSettingsSectionProps) {
  const { skills, onRefresh } = props;
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // 本地禁用技能列表 (前端 UI 状态，不与后端同步)
  const [disabledSkills, setDisabledSkills] = useState<Set<string>>(
    () => { try { return new Set(JSON.parse(localStorage.getItem("ccagent:disabledSkills") || "[]")); } catch { return new Set<string>(); } }
  );

  const toggleDisabled = async (name: string) => {
    const isCurrentlyDisabled = disabledSkills.has(name);
    try {
      if (isCurrentlyDisabled) await enableSkill(name);
      else await disableSkill(name);
    } catch { /* backend may not support */ }
    const next = new Set(disabledSkills);
    if (isCurrentlyDisabled) next.delete(name);
    else next.add(name);
    setDisabledSkills(next);
    localStorage.setItem("ccagent:disabledSkills", JSON.stringify([...next]));
  };

  const handleImport = async () => {
    const path = prompt("输入 SKILL.md 文件路径:");
    if (!path) return;
    try {
      await importSkill(path);
      toast("技能导入成功", "success");
      onRefresh();
    } catch (e) {
      toast(`导入失败: ${e}`, "error");
    }
  };

  const filtered = useMemo(() => {
    if (!searchQuery) return skills;
    const q = searchQuery.toLowerCase();
    return skills.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    );
  }, [skills, searchQuery]);

  const enabledCount = skills.length - disabledSkills.size;

  const handleCreate = async () => {
    if (!newName.trim() || !newContent.trim()) {
      toast("名称和内容不能为空", "error");
      return;
    }
    setCreating(true);
    try {
      await invoke("cc_create_skill", {
        name: newName.trim(),
        description: newDesc.trim(),
        content: newContent,
      });
      toast("技能创建成功", "success");
      setNewName("");
      setNewDesc("");
      setNewContent("");
      setShowCreate(false);
      onRefresh();
    } catch (e) {
      toast(`创建失败: ${e}`, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`确认删除技能 "${name}"？`)) return;
    try {
      await invoke("cc_delete_skill", { name });
      toast("已删除", "success");
      onRefresh();
    } catch (e) {
      toast(`删除失败: ${e}`, "error");
    }
  };

  return (
    <div className="cc-skills-section">
      <div className="cc-section-head">
        <span className="cc-section-title">🎭 技能管理</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="cc-section-add" onClick={handleImport}>📥 导入</button>
          <button className="cc-section-add" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "取消" : "＋ 新建"}
          </button>
        </div>
      </div>
      <div className="cc-section-desc">管理 Claude Code 自定义技能（写入 ~/.claude/skills/）</div>

      {showCreate && (
        <div className="cc-skill-editor">
          <label className="cc-agent-field-label">名称</label>
          <input
            className="cc-agent-field-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="my-skill"
          />
          <label className="cc-agent-field-label">描述</label>
          <input
            className="cc-agent-field-input"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="这个技能做什么..."
          />
          <label className="cc-agent-field-label">内容 (Markdown)</label>
          <textarea
            className="cc-agent-field-textarea"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="# 技能内容&#10;..."
            rows={8}
          />
          <div className="cc-agent-editor-actions">
            <button className="cc-agent-cancel" onClick={() => setShowCreate(false)}>取消</button>
            <button className="cc-agent-save" onClick={handleCreate} disabled={creating}>
              {creating ? "创建中..." : "创建"}
            </button>
          </div>
        </div>
      )}

      {skills.length === 0 ? (
        <div className="cc-agent-empty">暂无技能</div>
      ) : (
        <div className="cc-skills-list">
          <div className="cc-skills-bar">
            <input className="cc-skills-search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder={`搜索技能 (${enabledCount}/${skills.length} 启用)…`} />
          </div>
          {filtered.map((skill) => {
            const isDisabled = disabledSkills.has(skill.name);
            return (
            <div key={skill.name} className={`cc-skill-item ${isDisabled ? "cc-skill-disabled" : ""}`}>
              <FileIcon name="SKILL.md" />
              <div className="cc-skill-info">
                <div className="cc-skill-name">{skill.name}</div>
                <div className="cc-skill-desc">{skill.description}</div>
              </div>
              <label className="cc-toggle-switch cc-skill-toggle" title={isDisabled ? "启用" : "禁用"}>
                <input type="checkbox" checked={!isDisabled} onChange={() => toggleDisabled(skill.name)} />
                <span className="cc-toggle-slider"></span>
              </label>
              <button className="cc-agent-del" onClick={() => handleDelete(skill.name)} title="删除">🗑</button>
            </div>
          )})}
        </div>
      )}
    </div>
  );
}
