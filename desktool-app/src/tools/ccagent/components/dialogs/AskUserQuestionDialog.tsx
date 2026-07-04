// 问答交互弹窗 — Phase 8
// Claude 通过 AskUserQuestion 工具向用户提问，支持单选/多选/自定义输入/多问题分步

import { useState, useEffect, useCallback, useRef } from "react";

const OTHER_MARKER = "__OTHER__";
const MAX_CUSTOM = 2000;

export interface QuestionOption { label: string; description: string; }
export interface Question {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect: boolean;
}
export interface AskUserQuestionRequest {
  requestId: string;
  toolName: string;
  questions: Question[];
}

interface AskUserQuestionDialogProps {
  request: AskUserQuestionRequest | null;
  onSubmit: (requestId: string, answers: Record<string, string | string[]>) => void;
  onCancel: (requestId: string) => void;
  timeoutSeconds?: number;
}

function normalizeQuestion(raw: unknown): Question | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const question = typeof r.question === "string" ? r.question : typeof r.text === "string" ? r.text : "";
  const header = typeof r.header === "string" ? r.header : "";
  const multiSelect = typeof r.multiSelect === "boolean" ? r.multiSelect : false;
  const rawOpts = Array.isArray(r.options) ? r.options : Array.isArray(r.choices) ? r.choices : [];
  const options: QuestionOption[] = rawOpts
    .map((opt: unknown): QuestionOption | null => {
      if (typeof opt === "string") return { label: opt, description: "" };
      if (!opt || typeof opt !== "object") return null;
      const o = opt as Record<string, unknown>;
      const label = typeof o.label === "string" ? o.label : typeof o.value === "string" ? o.value : "";
      const description = typeof o.description === "string" ? o.description : "";
      return label ? { label, description } : null;
    })
    .filter(Boolean) as QuestionOption[];
  return question ? { question, header, options, multiSelect } : null;
}

export function AskUserQuestionDialog({
  request,
  onSubmit,
  onCancel,
  timeoutSeconds = 180,
}: AskUserQuestionDialogProps) {
  const [answers, setAnswers] = useState<Record<string, Set<string>>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [qIdx, setQIdx] = useState(0);
  const [remaining, setRemaining] = useState(timeoutSeconds);
  const startRef = useRef(Date.now());
  const customRef = useRef<HTMLTextAreaElement>(null);

  const questions = (request?.questions ?? []).map(normalizeQuestion).filter(Boolean) as Question[];

  useEffect(() => {
    if (request) {
      const initA: Record<string, Set<string>> = {};
      const initC: Record<string, string> = {};
      questions.forEach(q => { initA[q.question] = new Set(); initC[q.question] = ""; });
      setAnswers(initA);
      setCustomInputs(initC);
      setQIdx(0);
      setRemaining(timeoutSeconds);
      startRef.current = Date.now();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.requestId, timeoutSeconds]);

  useEffect(() => {
    if (!request) return;
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      const r = Math.max(0, timeoutSeconds - elapsed);
      setRemaining(r);
      if (r === 0) onCancel(request.requestId);
    }, 500);
    return () => clearInterval(id);
  }, [request, timeoutSeconds, onCancel]);

  const handleCancel = useCallback(() => {
    if (request) onCancel(request.requestId);
  }, [request, onCancel]);

  useEffect(() => {
    if (!request) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") handleCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request, handleCancel]);

  if (!request) return null;

  if (questions.length === 0) {
    return (
      <div className="cc-perm-overlay">
        <div className="cc-ask-dialog">
          <div className="cc-perm-title">❓ Claude 有问题想问你</div>
          <p className="cc-ask-empty">问题数据格式不支持，请取消后重试。</p>
          <div className="cc-perm-actions">
            <button className="cc-perm-deny" onClick={handleCancel}>取消</button>
          </div>
        </div>
      </div>
    );
  }

  const idx = Math.max(0, Math.min(qIdx, questions.length - 1));
  const q = questions[idx];
  const isLast = idx === questions.length - 1;
  const curSet = answers[q.question] ?? new Set<string>();
  const curCustom = customInputs[q.question] ?? "";
  const isOther = curSet.has(OTHER_MARKER);
  const isWarning = remaining < 20;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  function toggleOption(label: string) {
    setAnswers(prev => {
      const next = { ...prev };
      const set = new Set(next[q.question] ?? []);
      if (q.multiSelect) {
        if (set.has(label)) set.delete(label); else set.add(label);
      } else {
        set.clear();
        set.add(label);
      }
      next[q.question] = set;
      return next;
    });
    if (label === OTHER_MARKER) {
      setTimeout(() => customRef.current?.focus(), 0);
    }
  }

  function handleSubmit() {
    const formatted: Record<string, string | string[]> = {};
    questions.forEach(qq => {
      const set = answers[qq.question] ?? new Set<string>();
      const custom = customInputs[qq.question] ?? "";
      const labels = Array.from(set).filter(l => l !== OTHER_MARKER);
      if (set.has(OTHER_MARKER) && custom.trim()) labels.push(custom.trim());
      if (labels.length > 0) formatted[qq.question] = qq.multiSelect ? labels : labels[0]!;
    });
    onSubmit(request!.requestId, formatted);
  }

  const hasRegular = Array.from(curSet).some(l => l !== OTHER_MARKER);
  const hasValidCustom = isOther && curCustom.trim().length > 0;
  const canProceed = hasRegular || hasValidCustom;

  return (
    <div className="cc-perm-overlay">
      <div className="cc-ask-dialog">
        <div className="cc-perm-title">
          <span>❓ Claude 有问题想问你</span>
          <span className={`cc-perm-countdown ${isWarning ? "cc-perm-countdown-warn" : ""}`}>{mm}:{ss}</span>
        </div>

        <div className="cc-ask-progress">问题 {idx + 1} / {questions.length}</div>

        <div className="cc-ask-question">
          {q.header && <span className="cc-ask-tag">{q.header}</span>}
          <p className="cc-ask-text">{q.question}</p>

          <div className="cc-ask-options">
            {q.options.map(opt => {
              const selected = curSet.has(opt.label);
              return (
                <button
                  key={opt.label}
                  className={`cc-ask-option ${selected ? "selected" : ""}`}
                  onClick={() => toggleOption(opt.label)}
                >
                  <span className="cc-ask-checkbox">{q.multiSelect ? (selected ? "☑" : "☐") : (selected ? "●" : "○")}</span>
                  <span className="cc-ask-option-content">
                    <span className="cc-ask-option-label">{opt.label}</span>
                    {opt.description && <span className="cc-ask-option-desc">{opt.description}</span>}
                  </span>
                </button>
              );
            })}
            <button
              className={`cc-ask-option ${isOther ? "selected" : ""}`}
              onClick={() => toggleOption(OTHER_MARKER)}
            >
              <span className="cc-ask-checkbox">{q.multiSelect ? (isOther ? "☑" : "☐") : (isOther ? "●" : "○")}</span>
              <span className="cc-ask-option-content">
                <span className="cc-ask-option-label">其他</span>
                <span className="cc-ask-option-desc">输入自定义答案</span>
              </span>
            </button>
          </div>

          {isOther && (
            <textarea
              ref={customRef}
              className="cc-ask-custom"
              value={curCustom}
              onChange={e => setCustomInputs(p => ({ ...p, [q.question]: e.target.value.slice(0, MAX_CUSTOM) }))}
              placeholder="请输入您的答案..."
              rows={3}
              maxLength={MAX_CUSTOM}
            />
          )}

          {q.multiSelect && <p className="cc-ask-hint">可以选择多个选项</p>}
        </div>

        <div className="cc-perm-actions">
          <button className="cc-perm-deny" onClick={handleCancel}>取消</button>
          <div className="cc-perm-actions-right">
            {idx > 0 && <button className="cc-perm-allow" onClick={() => setQIdx(i => Math.max(0, i - 1))}>上一步</button>}
            <button
              className={`cc-perm-allow ${!canProceed ? "cc-perm-disabled" : ""}`}
              onClick={handleSubmit}
              disabled={!canProceed}
            >
              {isLast ? "提交" : "下一步"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
