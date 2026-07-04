// SkillHelpDialog — Skills 帮助对话框
// 对齐 cc-gui skills/SkillHelpDialog.tsx
// 适配：用中文文案内联替代 i18n key，用 copyText 替代 copyToClipboard

import { useLocale } from "../../hooks/useLocale";
import { useState, useCallback } from "react";
import { copyText } from "../../../../useCopyFeedback";

const COPIED_INDICATOR_STYLE: React.CSSProperties = {
  marginLeft: "8px",
  color: "var(--vscode-charts-green, #4caf50)",
  fontSize: "12px",
};

export interface SkillHelpDialogProps {
  onClose: () => void;
  currentProvider?: string;
}

export function SkillHelpDialog({ onClose, currentProvider = "claude" }: SkillHelpDialogProps) {
  const { t } = useLocale();
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleLinkClick = useCallback(async (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    try {
      await copyText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      // copyText 内部已 toast，此处忽略
    }
  }, []);

  const isCodex = currentProvider === "codex";

  const structureExample = `my-skill/
  ├── SKILL.md
  ├── references/
  │   └── guide.md
  └── scripts/
      └── helper.py`;

  const formatExample = `---
name: my-skill
description: 描述这个 Skill 的用途
version: 1.0.0
---

# Skill 标题

## 使用说明
...`;

  return (
    <div className="skill-dialog-backdrop" onClick={handleBackdropClick}>
      <div className="skill-dialog help-dialog">
        <div className="dialog-header">
          <h3>{isCodex ? "Codex Skills 使用帮助" : "Claude Skills 使用帮助"}</h3>
          <button className="close-btn" onClick={onClose}>
            <span className="codicon codicon-close" />
          </button>
        </div>

        <div className="dialog-content help-content">
          <section className="help-section">
            <h4><span className="codicon codicon-extensions" />{t("skillHelpDialog.skillHelpDialog.k1")}</h4>
            <p>
              Skills 是可复用的能力包，让 AI 助手能执行特定领域的任务。
              每个 Skill 包含说明文档（SKILL.md）和可选的参考资源、脚本。
            </p>
          </section>

          <section className="help-section">
            <h4><span className="codicon codicon-folder" />{t("skillHelpDialog.skillHelpDialog.k2")}</h4>
            <p>{t("skillHelpDialog.skillHelpDialog.k3")}</p>
            <pre className="code-block">{structureExample}</pre>
          </section>

          <section className="help-section">
            <h4><span className="codicon codicon-file-code" />{t("skillHelpDialog.skillHelpDialog.k4")}</h4>
            <p>{t("skillHelpDialog.skillHelpDialog.k5")}</p>
            <pre className="code-block">{formatExample}</pre>
            <p className="hint-text">
              <code>name</code> 和 <code>description</code> 是必填字段，其余可选。
            </p>
          </section>

          <section className="help-section">
            <h4><span className="codicon codicon-gear" />{t("skillHelpDialog.skillHelpDialog.k7")}</h4>
            <p>{t("skillHelpDialog.skillHelpDialog.k8")}</p>
            {isCodex ? (
              <ul>
                <li><strong>{t("skillHelpDialog.skillHelpDialog.k9")}</strong>：~/.codex/skills/</li>
                <li><strong>{t("skillHelpDialog.skillHelpDialog.k10")}</strong>：.codex/skills/</li>
                <li><strong>{t("skillHelpDialog.skillHelpDialog.k11")}</strong>{t("skillHelpDialog.skillHelpDialog.k12")}</li>
              </ul>
            ) : (
              <ul>
                <li><strong>{t("skillHelpDialog.skillHelpDialog.k13")}</strong>{t("skillHelpDialog.skillHelpDialog.k14")}</li>
                <li><strong>{t("skillHelpDialog.skillHelpDialog.k15")}</strong>{t("skillHelpDialog.skillHelpDialog.k16")}</li>
                <li><strong>{t("skillHelpDialog.skillHelpDialog.k17")}</strong>{t("skillHelpDialog.skillHelpDialog.k18")}</li>
              </ul>
            )}
          </section>

          <section className="help-section">
            <h4><span className="codicon codicon-lightbulb" />{t("skillHelpDialog.skillHelpDialog.k19")}</h4>
            <ul>
              <li>{t("skillHelpDialog.skillHelpDialog.k20")}</li>
              <li>{t("skillHelpDialog.skillHelpDialog.k21")}</li>
              <li>{t("skillHelpDialog.skillHelpDialog.k22")}</li>
              <li>{t("skillHelpDialog.skillHelpDialog.k23")}</li>
              <li>{t("skillHelpDialog.skillHelpDialog.k24")}</li>
            </ul>
          </section>

          <section className="help-section">
            <h4><span className="codicon codicon-link-external" />{t("skillHelpDialog.skillHelpDialog.k25")}</h4>
            <p>{t("skillHelpDialog.skillHelpDialog.k26")}</p>
            {isCodex ? (
              <ul>
                <li>
                  <a href="https://codex.openai.com/docs/skills" onClick={(e) => handleLinkClick(e, "https://codex.openai.com/docs/skills")}>
                    Codex Skills 官方文档
                  </a>
                  {copiedUrl === "https://codex.openai.com/docs/skills" && (
                    <span style={COPIED_INDICATOR_STYLE}>{t("skillHelpDialog.skillHelpDialog.k27")}</span>
                  )}
                </li>
              </ul>
            ) : (
              <ul>
                <li>
                  <a href="https://support.claude.com/en/articles/12512176-what-are-skills" onClick={(e) => handleLinkClick(e, "https://support.claude.com/en/articles/12512176-what-are-skills")}>
                    什么是 Skills
                  </a>
                  {copiedUrl === "https://support.claude.com/en/articles/12512176-what-are-skills" && (
                    <span style={COPIED_INDICATOR_STYLE}>{t("skillHelpDialog.skillHelpDialog.k28")}</span>
                  )}
                </li>
                <li>
                  <a href="https://support.claude.com/en/articles/12512198-creating-custom-skills" onClick={(e) => handleLinkClick(e, "https://support.claude.com/en/articles/12512198-creating-custom-skills")}>
                    创建自定义 Skills
                  </a>
                  {copiedUrl === "https://support.claude.com/en/articles/12512198-creating-custom-skills" && (
                    <span style={COPIED_INDICATOR_STYLE}>{t("skillHelpDialog.skillHelpDialog.k29")}</span>
                  )}
                </li>
                <li>
                  <a href="https://github.com/anthropics/skills" onClick={(e) => handleLinkClick(e, "https://github.com/anthropics/skills")}>
                    Anthropic Skills 仓库
                  </a>
                  {copiedUrl === "https://github.com/anthropics/skills" && (
                    <span style={COPIED_INDICATOR_STYLE}>{t("skillHelpDialog.skillHelpDialog.k30")}</span>
                  )}
                </li>
              </ul>
            )}
          </section>
        </div>

        <div className="dialog-footer">
          <button className="btn-primary" onClick={onClose}>{t("skillHelpDialog.skillHelpDialog.k31")}</button>
        </div>
      </div>
    </div>
  );
}

export default SkillHelpDialog;
