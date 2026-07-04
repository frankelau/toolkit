/**
 * Self-contained Codex event handler for the DeskTool NDJSON bridge.
 *
 * Adapted from ccgui (services/codex/codex-event-handler.js) but decoupled from
 * Java IPC and the fragile session-JSONL scanning/rollback. It consumes the
 * @openai/codex-sdk `thread.runStreamed()` event stream and emits messages in
 * the SAME Claude-compatible shape the frontend already renders:
 *   { type:'assistant', message:{ role:'assistant', content:[ {type:'text'|'thinking'|'tool_use'} ] } }
 *   { type:'user',      message:{ role:'user',      content:[ {type:'tool_result'} ] } }
 *   { type:'result', subtype:'usage', usage:{...}, session_id }
 *
 * Command confirmation ("支持确认命令") is handled via an async `requestPermission`
 * callback supplied by the bridge, which round-trips through the frontend dialog.
 */

import { randomUUID } from 'crypto';
import {
  truncateForDisplay, getStableItemId, extractCommand,
  smartToolName, smartDescription, mapCommandToolNameToPermissionToolName,
} from './codex-command-utils.js';
import { extractPatchFromResponseItemPayload, parseApplyPatchToOperations } from './codex-patch-parser.js';
import {
  normalizeMcpToolName, normalizeMcpToolInput,
  parseFunctionCallArguments, normalizeFunctionCallTool,
  rememberToolInvocation, findMatchingToolUseId,
} from './codex-tool-normalization.js';

const MAX_TOOL_RESULT_CHARS = 30000;
const COMMAND_DENIED_ABORT_ERROR = '__CODEX_COMMAND_DENIED_ABORT__';

// ── Claude-shaped message builders ──
function toolUseMsg(id, name, input) {
  return { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } };
}
function toolResultMsg(toolUseId, isError, content) {
  return { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseId, is_error: isError, content }] } };
}
function textMsg(text) {
  return { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } };
}
function thinkingMsg(text) {
  return { type: 'assistant', message: { role: 'assistant', content: [{ type: 'thinking', thinking: text, text }] } };
}

export function createInitialEventState(emitMessage) {
  return {
    pendingToolUseIds: new Map(),
    emittedToolUseIds: new Set(),
    emittedToolResultIds: new Set(),
    toolCallSignatureById: new Map(),
    toolUseIdBySignature: new Map(),
    deniedCommandToolUseIds: new Set(),
    emittedDeniedCommandToolResultIds: new Set(),
    processedPatchCallIds: new Set(),
    reasoningTextCache: new Map(),
    assistantTextCache: new Map(),
    reasoningObserved: false,
    commandApprovalAbortRequested: false,
    suppressNoResponseFallback: false,
    turnCompleted: false,
    currentThreadId: null,
    finalResponse: '',
    assistantText: '',
    emitMessage,
  };
}

function extractAppendedDelta(previousText, nextText) {
  const previous = typeof previousText === 'string' ? previousText : '';
  const next = typeof nextText === 'string' ? nextText : '';
  if (!next.trim()) return '';
  if (!previous) return next;
  if (next === previous) return '';
  if (!next.startsWith(previous)) return '';
  return next.slice(previous.length);
}

// ── tool-use id bookkeeping ──
function rememberPendingToolUseId(state, command, toolUseId) {
  if (!command) return;
  const list = state.pendingToolUseIds.get(command) ?? [];
  list.push(toolUseId);
  state.pendingToolUseIds.set(command, list);
}
function consumePendingToolUseId(state, command) {
  if (!command) return null;
  const list = state.pendingToolUseIds.get(command);
  if (!Array.isArray(list) || list.length === 0) return null;
  const id = list.shift() ?? null;
  if (list.length === 0) state.pendingToolUseIds.delete(command);
  return id;
}
function ensureToolUseId(state, phase, item) {
  const stableId = getStableItemId(item);
  if (stableId) return stableId;
  const command = extractCommand(item);
  if (phase === 'completed') return consumePendingToolUseId(state, command) ?? randomUUID();
  const id = randomUUID();
  rememberPendingToolUseId(state, command, id);
  return id;
}

// ── reasoning (thinking) ──
function maybeEmitReasoning(state, item) {
  if (!item || item.type !== 'reasoning') return;
  const raw = typeof item.text === 'string' ? item.text : '';
  const text = raw.trim();
  if (!text) return;
  const stableId = getStableItemId(item) ?? randomUUID();
  const previousText = state.reasoningTextCache.get(stableId) ?? '';
  if (previousText === text) return;
  state.reasoningTextCache.set(stableId, text);
  state.reasoningObserved = true;
  state.emitMessage(thinkingMsg(text));
}

// ── agent (assistant) text ──
function handleAgentMessage(item, state, { emitSnapshot = true } = {}) {
  const text = item.text || '';
  const stableId = getStableItemId(item) ?? 'agent_message';
  const previousText = state.assistantTextCache.get(stableId) ?? '';
  const delta = extractAppendedDelta(previousText, text);
  state.finalResponse = text;
  state.assistantTextCache.set(stableId, text);
  if (delta) state.assistantText += delta;
  if (emitSnapshot && text && text.trim()) state.emitMessage(textMsg(text));
}

// ── command execution result ──
function handleCommandExecution(item, state) {
  const toolUseId = ensureToolUseId(state, 'completed', item);
  const command = extractCommand(item);
  if (state.deniedCommandToolUseIds.has(toolUseId)) {
    emitDeniedCommandToolResultOnce(state, toolUseId);
    return;
  }
  const output = item.aggregated_output ?? item.output ?? item.stdout ?? item.result ?? '';
  const outputStrRaw = typeof output === 'string' ? output : JSON.stringify(output);
  const outputStr = truncateForDisplay(outputStrRaw, MAX_TOOL_RESULT_CHARS);
  const isError = (typeof item.exit_code === 'number' && item.exit_code !== 0) || item.is_error === true;
  const toolName = smartToolName(command);
  const description = smartDescription(command);
  if (!state.emittedToolUseIds.has(toolUseId)) {
    state.emitMessage(toolUseMsg(toolUseId, toolName, { command, description }));
    state.emittedToolUseIds.add(toolUseId);
  }
  state.emitMessage(toolResultMsg(toolUseId, isError, outputStr && outputStr.trim() ? outputStr : '(no output)'));
  state.emittedToolResultIds.add(toolUseId);
}

// ── file change (apply_patch) — emit as Write/Edit tool_use so frontend renders diff ──
function handleFileChange(item, state) {
  const status = item.status || 'completed';
  const isError = status !== 'completed';
  // Codex file_change items may carry `changes` (array of {path, kind, ...}) or a raw patch.
  const patchText = extractPatchFromResponseItemPayload(item) || item.patch || '';
  let operations = [];
  if (patchText) operations = parseApplyPatchToOperations(patchText);
  else if (Array.isArray(item.changes)) {
    operations = item.changes.map((c) => ({
      filePath: c.path || c.file_path || '',
      kind: c.kind || 'update',
      oldString: c.old_string ?? c.oldString ?? '',
      newString: c.new_string ?? c.newString ?? c.content ?? '',
      toolName: (c.kind === 'add' || c.kind === 'delete') ? 'write' : 'edit',
    })).filter((o) => o.filePath);
  }
  if (operations.length === 0) return;
  for (const op of operations) {
    const toolUseId = randomUUID();
    const isWrite = op.toolName === 'write' || op.kind === 'add';
    const toolName = isWrite ? 'Write' : 'Edit';
    const input = isWrite
      ? { file_path: op.filePath, content: op.newString ?? '' }
      : { file_path: op.filePath, old_string: op.oldString ?? '', new_string: op.newString ?? '', replace_all: false };
    state.emitMessage(toolUseMsg(toolUseId, toolName, input));
    state.emittedToolUseIds.add(toolUseId);
    state.emitMessage(toolResultMsg(toolUseId, isError, isError ? 'Patch apply failed' : 'Patch applied'));
    state.emittedToolResultIds.add(toolUseId);
  }
}

// ── MCP tool call ──
function handleMcpToolCall(item, state) {
  const toolName = normalizeMcpToolName(item.server, item.tool);
  const toolInput = normalizeMcpToolInput(item.server, item.tool, item.arguments || {});
  const matchedToolUseId = findMatchingToolUseId(state, toolName, toolInput);
  const toolUseId = matchedToolUseId || item.id || randomUUID();
  const isError = item.status === 'failed' || !!item.error;
  if (!state.emittedToolUseIds.has(toolUseId)) {
    state.emitMessage(toolUseMsg(toolUseId, toolName, toolInput));
    state.emittedToolUseIds.add(toolUseId);
  }
  rememberToolInvocation(state, toolUseId, toolName, toolInput);
  let resultContent = '(no output)';
  if (item.error) resultContent = item.error.message || 'MCP tool call failed';
  else if (item.result) {
    if (item.result.content && Array.isArray(item.result.content)) {
      const textParts = item.result.content.filter((b) => b.type === 'text').map((b) => b.text);
      resultContent = textParts.length > 0 ? textParts.join('\n') : JSON.stringify(item.result);
    } else if (item.result.structured_content) resultContent = JSON.stringify(item.result.structured_content);
    else resultContent = JSON.stringify(item.result);
  }
  const truncated = truncateForDisplay(resultContent, MAX_TOOL_RESULT_CHARS);
  state.emitMessage(toolResultMsg(toolUseId, isError, truncated && truncated.trim() ? truncated : '(no output)'));
  state.emittedToolResultIds.add(toolUseId);
}

function emitDeniedCommandToolResultOnce(state, toolUseId, messageText = 'Command denied by user') {
  if (!toolUseId || state.emittedDeniedCommandToolResultIds.has(toolUseId)) return;
  state.emitMessage(toolResultMsg(toolUseId, true, messageText));
  state.emittedToolResultIds.add(toolUseId);
  state.emittedDeniedCommandToolResultIds.add(toolUseId);
}

// ── command approval gate (支持确认命令) ──
async function maybeRequestCommandApproval(state, config, { toolUseId, command, smartTool, description }) {
  const shouldApprove = config.approvalPolicy && config.approvalPolicy !== 'never';
  if (!shouldApprove) return true;
  const permissionToolName = mapCommandToolNameToPermissionToolName(smartTool);
  try {
    const allowed = await config.requestPermission(permissionToolName, { command, description, source: 'codex_command_execution' });
    if (allowed) return true;
  } catch { /* deny by default */ }
  state.deniedCommandToolUseIds.add(toolUseId);
  state.suppressNoResponseFallback = true;
  emitDeniedCommandToolResultOnce(state, toolUseId, 'Command denied by user and turn aborted');
  state.commandApprovalAbortRequested = true;
  try { config.turnAbortController.abort(); } catch { /* ignore */ }
  return false;
}

function handleFunctionCallPayload(payload, state) {
  if (!payload || payload.type !== 'function_call') return false;
  const rawToolName = typeof payload.name === 'string' ? payload.name : '';
  if (!rawToolName) return false;
  const parsedArguments = parseFunctionCallArguments(payload);
  const normalized = normalizeFunctionCallTool(rawToolName, parsedArguments);
  const matchedToolUseId = findMatchingToolUseId(state, normalized.name, normalized.input);
  const toolUseId = matchedToolUseId || (typeof payload.call_id === 'string' && payload.call_id ? payload.call_id : randomUUID());
  if (!state.emittedToolUseIds.has(toolUseId)) {
    state.emitMessage(toolUseMsg(toolUseId, normalized.name, normalized.input));
    state.emittedToolUseIds.add(toolUseId);
    rememberToolInvocation(state, toolUseId, normalized.name, normalized.input);
  }
  return true;
}

/**
 * Process the Codex SDK event stream.
 * @param {AsyncIterable} events
 * @param {object} state  created via createInitialEventState
 * @param {object} config { approvalPolicy, requestPermission(toolName,input)->Promise<bool>, turnAbortController, onUsage }
 */
export async function processCodexEventStream(events, state, config) {
  try {
    for await (const event of events) {
      switch (event.type) {
        case 'thread.started': {
          state.currentThreadId = event.thread_id;
          break;
        }
        case 'turn.started': {
          state.turnCompleted = false;
          break;
        }
        case 'item.started': {
          maybeEmitReasoning(state, event.item);
          if (event.item && event.item.type === 'command_execution') {
            const toolUseId = ensureToolUseId(state, 'started', event.item);
            const command = extractCommand(event.item);
            const toolName = smartToolName(command);
            const description = smartDescription(command);
            state.emitMessage(toolUseMsg(toolUseId, toolName, { command, description }));
            state.emittedToolUseIds.add(toolUseId);
            rememberToolInvocation(state, toolUseId, toolName, { command, description });
            const allowed = await maybeRequestCommandApproval(state, config, { toolUseId, command, smartTool: toolName, description });
            if (!allowed) throw new Error(COMMAND_DENIED_ABORT_ERROR);
          } else if (event.item && event.item.type === 'mcp_tool_call') {
            const toolName = normalizeMcpToolName(event.item.server, event.item.tool);
            const toolInput = normalizeMcpToolInput(event.item.server, event.item.tool, event.item.arguments || {});
            const matchedToolUseId = findMatchingToolUseId(state, toolName, toolInput);
            const toolUseId = matchedToolUseId || event.item.id || randomUUID();
            if (!state.emittedToolUseIds.has(toolUseId)) {
              state.emitMessage(toolUseMsg(toolUseId, toolName, toolInput));
              state.emittedToolUseIds.add(toolUseId);
            }
            rememberToolInvocation(state, toolUseId, toolName, toolInput);
          }
          break;
        }
        case 'item.updated': {
          maybeEmitReasoning(state, event.item);
          if (event.item && event.item.type === 'agent_message') {
            handleAgentMessage(event.item, state, { emitSnapshot: false });
          }
          break;
        }
        case 'item.completed': {
          if (!event.item) break;
          maybeEmitReasoning(state, event.item);
          if (event.item.type === 'agent_message') handleAgentMessage(event.item, state);
          else if (event.item.type === 'command_execution') handleCommandExecution(event.item, state);
          else if (event.item.type === 'file_change') handleFileChange(event.item, state);
          else if (event.item.type === 'mcp_tool_call') handleMcpToolCall(event.item, state);
          break;
        }
        case 'turn.completed': {
          state.turnCompleted = true;
          if (event.usage) {
            state.emitMessage({
              type: 'result', subtype: 'usage', is_error: false,
              usage: {
                input_tokens: event.usage.input_tokens || 0,
                output_tokens: event.usage.output_tokens || 0,
                cache_creation_input_tokens: 0,
                cache_read_input_tokens: event.usage.cached_input_tokens || 0,
              },
              session_id: state.currentThreadId,
              uuid: randomUUID(),
            });
          }
          break;
        }
        case 'turn.failed': {
          const errorMsg = event.error?.message || 'Turn failed';
          if (state.commandApprovalAbortRequested && /aborted|abort|cancel|interrupt/i.test(errorMsg)) break;
          throw new Error(errorMsg);
        }
        case 'error': {
          const generalError = event.message || 'Unknown error';
          if (state.commandApprovalAbortRequested && /aborted|abort|cancel|interrupt/i.test(generalError)) break;
          throw new Error(generalError);
        }
        default: {
          if (event.type === 'response_item' && event.payload) {
            handleFunctionCallPayload(event.payload, state);
          }
          break;
        }
      }
    }
  } catch (streamError) {
    const msg = streamError?.message || String(streamError);
    if (state.commandApprovalAbortRequested && (msg === COMMAND_DENIED_ABORT_ERROR || /aborted|abort|cancel|interrupt/i.test(msg))) {
      // swallow: user denied a command, turn was aborted intentionally
      return;
    }
    throw streamError;
  }
}

export { COMMAND_DENIED_ABORT_ERROR };
