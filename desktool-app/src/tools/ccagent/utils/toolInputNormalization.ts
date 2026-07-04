import { normalizeToolName } from "./toolConstants";
import { normalizeTodoStatus } from "./todoShared";
import type { RawTodoItem } from "./todoShared";

type ToolInput = Record<string, unknown>;

type EditItem = {
  oldText?: unknown;
  newText?: unknown;
};

function getFirstEdit(input: ToolInput): EditItem | undefined {
  const edits = input.edits;
  if (!Array.isArray(edits) || edits.length === 0) return undefined;
  const first = edits[0];
  return first && typeof first === "object" ? (first as EditItem) : undefined;
}

function normalizePlanEntries(input: ToolInput): ToolInput {
  const plan = Array.isArray(input.plan) ? input.plan : [];
  return {
    ...input,
    plan: plan
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const candidate = item as RawTodoItem;
        const content =
          typeof candidate.content === "string" && candidate.content.trim() ? candidate.content.trim() :
          typeof candidate.step === "string" && candidate.step.trim() ? candidate.step.trim() :
          typeof candidate.title === "string" && candidate.title.trim() ? candidate.title.trim() :
          typeof candidate.text === "string" && candidate.text.trim() ? candidate.text.trim() :
          "";
        if (!content) return null;
        return {
          ...candidate,
          content,
          step: content,
          status: normalizeTodoStatus(candidate.status),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
  };
}

function extractPromptFromItems(items: unknown): string | undefined {
  if (!Array.isArray(items)) {
    return undefined;
  }

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    if (candidate.type === "text" && typeof candidate.text === "string" && candidate.text.trim()) {
      return candidate.text;
    }
  }

  return undefined;
}

function normalizeSpawnAgentInput(input: ToolInput): ToolInput {
  const prompt =
    typeof input.prompt === "string" && input.prompt.trim() ? input.prompt :
    typeof input.message === "string" && input.message.trim() ? input.message :
    extractPromptFromItems(input.items);

  const subagentType =
    typeof input.subagent_type === "string" && input.subagent_type.trim() ? input.subagent_type :
    typeof input.subagentType === "string" && input.subagentType.trim() ? input.subagentType :
    typeof input.agent_type === "string" && input.agent_type.trim() ? input.agent_type :
    typeof input.agentType === "string" && input.agentType.trim() ? input.agentType :
    "default";

  return {
    ...input,
    subagent_type: subagentType,
    prompt,
    description:
      typeof input.description === "string" && input.description.trim() ? input.description :
      typeof input.message === "string" && input.message.trim() ? input.message :
      typeof prompt === "string" ? prompt : undefined,
  };
}

export function normalizeToolInput(
  name: string | undefined,
  input: ToolInput | undefined,
): ToolInput | undefined {
  if (!input) return input;

  const normalizedName = normalizeToolName(name ?? "");
  if (normalizedName === "edit_file") {
    const firstEdit = getFirstEdit(input);
    return {
      ...input,
      file_path:
        (typeof input.file_path === "string" ? input.file_path : undefined) ??
        (typeof input.filePath === "string" ? input.filePath : undefined) ??
        (typeof input.path === "string" ? input.path : undefined),
      old_string:
        (typeof input.old_string === "string" ? input.old_string : undefined) ??
        (typeof input.oldString === "string" ? input.oldString : undefined) ??
        (typeof firstEdit?.oldText === "string" ? firstEdit.oldText : undefined),
      new_string:
        (typeof input.new_string === "string" ? input.new_string : undefined) ??
        (typeof input.newString === "string" ? input.newString : undefined) ??
        (typeof firstEdit?.newText === "string" ? firstEdit.newText : undefined),
    };
  }

  if (normalizedName === "write_file") {
    return {
      ...input,
      file_path:
        (typeof input.file_path === "string" ? input.file_path : undefined) ??
        (typeof input.filePath === "string" ? input.filePath : undefined) ??
        (typeof input.path === "string" ? input.path : undefined),
      new_string:
        (typeof input.new_string === "string" ? input.new_string : undefined) ??
        (typeof input.newString === "string" ? input.newString : undefined) ??
        (typeof input.content === "string" ? input.content : undefined),
    };
  }

  if (normalizedName === "update_plan") {
    return normalizePlanEntries(input);
  }

  if (normalizedName === "spawn_agent") {
    return normalizeSpawnAgentInput(input);
  }

  return input;
}
