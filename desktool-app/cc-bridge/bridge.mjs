#!/usr/bin/env node
/**
 * DeskTool CC Bridge v2 — NDJSON bridge for Claude Agent SDK + OpenAI Codex SDK
 *
 * stdin (Rust → Bridge):
 *   {"id":"1","method":"send","params":{engine:"claude"|"codex","message":"...",...}}
 *   {"id":"2","method":"permission_response","params":{"toolUseId":"xxx","behavior":"allow|deny"}}
 *   {"id":"3","method":"abort"}
 *   {"id":"4","method":"heartbeat"}
 *
 * stdout (Bridge → Rust):
 *   {"type":"daemon","event":"ready","pid":12345}
 *   {"type":"stream","data":{"type":"assistant","message":{...}}}
 *   {"type":"permission_request","toolUseId":"xxx","toolName":"Bash","input":{...}}
 *   {"type":"result","success":true,"sessionId":"xxx","costUsd":0.01}
 *   {"type":"result","success":true,"threadId":"xxx"}          ← codex
 */

import * as sdk from '@anthropic-ai/claude-agent-sdk';
import { createInterface } from 'readline';
import { existsSync, readdirSync } from 'fs';
import { isAbsolute, resolve as resolvePath, basename, join } from 'path';

// Codex handler (loaded lazily)
let codexHandlerModule = null;

// ── State ──────────────────────────────────────────────────────────────────
let activeController = null;
let currentSessionId = null;
let totalCost = 0;
let totalInputTokens = 0;
let totalOutputTokens = 0;

// Pending permission requests: toolUseId → { resolve, reject, timer }
const pendingPermissions = new Map();

// Current session cwd — updated by processClaude/processCodex for path normalization
let sessionCwd = process.cwd();

// ── Output helpers ─────────────────────────────────────────────────────────
const _write = process.stdout.write.bind(process.stdout);
function send(obj) {
  _write(JSON.stringify(obj) + '\n', 'utf8');
}
function sendDaemonEvent(event, data = {}) {
  send({ type: 'daemon', event, ...data });
}

// ── Path normalization ─────────────────────────────────────────────────────
// Intercepts tool inputs that reference absolute paths non-existent on this
// machine (e.g. paths from a different dev environment carried in context).

// Fields that expect a DIRECTORY — safe to fall back to cwd
const DIR_PATH_FIELDS = new Set(['path', 'directory', 'dir']);
// Fields that expect a FILE — we search under cwd for the same filename
const FILE_PATH_FIELDS = new Set(['file_path', 'filePath', 'notebook_path']);

function findFileUnderCwd(filename, cwd, maxDepth = 3) {
  function search(dir, depth) {
    if (depth > maxDepth) return null;
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === filename) return join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const found = search(join(dir, entry.name), depth + 1);
          if (found) return found;
        }
      }
    } catch { /* ignore unreadable dirs */ }
    return null;
  }
  return search(cwd, 0);
}

function normalizeToolInput(toolName, input, cwd) {
  if (!input || !cwd) return input;
  const result = { ...input };
  for (const [field, val] of Object.entries(result)) {
    if (typeof val !== 'string' || !isAbsolute(val) || existsSync(val)) continue;

    if (DIR_PATH_FIELDS.has(field)) {
      result[field] = cwd;
      process.stderr.write(`[bridge] path-fix(dir): ${toolName}.${field} "${val}" → "${cwd}"\n`);
    } else if (FILE_PATH_FIELDS.has(field)) {
      const name = basename(val);
      const found = findFileUnderCwd(name, cwd);
      if (found) {
        result[field] = found;
        process.stderr.write(`[bridge] path-fix(file): ${toolName}.${field} "${val}" → "${found}"\n`);
      } else {
        process.stderr.write(`[bridge] path-fix(skip): ${toolName}.${field} "${val}" not found under cwd\n`);
      }
    }
  }
  return result;
}

// ── Shared permission mechanism ────────────────────────────────────────────
// Used by BOTH Claude (canUseTool callback) and Codex (requestPermission callback).

const SAFE_TOOLS = new Set([
  'Read', 'Glob', 'Grep', 'LSP', 'TodoWrite',
  'TaskCreate', 'TaskGet', 'TaskUpdate', 'TaskList', 'TaskStop', 'TaskOutput',
  'ToolSearch', 'ListMcpResourcesTool', 'ReadMcpResourceTool',
  'AskUserQuestion', 'EnterPlanMode', 'ExitPlanMode', 'SendMessage', 'Sleep',
]);

function requestPermission(toolName, input) {
  const toolUseId = Math.random().toString(36).slice(2);
  send({ type: 'permission_request', toolUseId, toolName, input });
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingPermissions.delete(toolUseId);
      resolve(false); // timeout → deny
    }, 65000);
    pendingPermissions.set(toolUseId, { resolve, timer });
  });
}

function handlePermissionResponse(toolUseId, behavior) {
  const pending = pendingPermissions.get(toolUseId);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingPermissions.delete(toolUseId);
  pending.resolve(behavior === 'allow');
}

function clearAllPendingPermissions(reason = 'session ended') {
  for (const [, pending] of pendingPermissions) {
    clearTimeout(pending.timer);
    pending.resolve(false);
  }
  pendingPermissions.clear();
}

// Claude SDK canUseTool callback
async function canUseTool(toolName, input, options) {
  const toolUseId = options?.toolUseId || Math.random().toString(36).slice(2);
  const normalizedInput = normalizeToolInput(toolName, input, sessionCwd);
  if (SAFE_TOOLS.has(toolName) && toolName !== 'ExitPlanMode') {
    return { behavior: 'allow', updatedInput: normalizedInput };
  }
  send({ type: 'permission_request', toolUseId, toolName, input: normalizedInput, options: { agentID: options?.agentID } });
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingPermissions.delete(toolUseId);
      resolve({ behavior: 'deny', message: 'Permission request timeout (65s)' });
    }, 65000);
    pendingPermissions.set(toolUseId, {
      resolve: (allowed) => resolve(allowed ? { behavior: 'allow', updatedInput: input } : { behavior: 'deny', message: 'User denied' }),
      timer,
    });
  });
}

// ── Claude send ───────────────────────────────────────────────────────────
async function processClaude(params) {
  const {
    message, cwd, model, systemPrompt, appendSystemPrompt,
    permissionMode = 'default', effort, mcpConfig,
    allowedTools, disallowedTools, sessionId: resumeSessionId, attachments,
    baseUrl, apiKey,
    thinking, includePartialMessages,
  } = params;

  sessionCwd = cwd || process.cwd(); // keep in sync for canUseTool path normalization

  const options = {
    cwd: cwd || process.cwd(),
    permissionMode,
    maxTurns: 100,
    enableFileCheckpointing: true,
    canUseTool,
    settingSources: ['user', 'project', 'local'],
  };

  // Provider overrides (e.g. zhipu, kimi, deepseek, custom endpoint)
  if (baseUrl) options.env = { ...(options.env || {}), ANTHROPIC_BASE_URL: baseUrl };
  if (apiKey) options.env = { ...(options.env || {}), ANTHROPIC_AUTH_TOKEN: apiKey };

  if (model) options.model = model;
  if (effort) options.effort = effort;
  if (systemPrompt) options.systemPrompt = { type: 'preset', preset: 'claude_code', append: systemPrompt };
  else if (appendSystemPrompt) options.systemPrompt = { type: 'preset', preset: 'claude_code', append: appendSystemPrompt };

  // Thinking config (adaptive, enabled with budget, or disabled)
  if (thinking !== undefined) {
    options.thinking = thinking;
  }

  // True streaming (includePartialMessages) for real-time text updates
  if (includePartialMessages !== undefined) {
    options.includePartialMessages = includePartialMessages;
  }

  if (mcpConfig) {
    try {
      const parsed = typeof mcpConfig === 'string' ? JSON.parse(mcpConfig) : mcpConfig;
      if (parsed.mcpServers) options.mcpServers = parsed.mcpServers;
    } catch { /* ignore */ }
  }

  if (allowedTools?.length > 0) options.allowedTools = allowedTools;
  if (disallowedTools?.length > 0) options.disallowedTools = disallowedTools;
  if (resumeSessionId) options.resume = resumeSessionId;

  let prompt;
  if (attachments?.length > 0) {
    const contentBlocks = [];
    if (message) contentBlocks.push({ type: 'text', text: message });
    for (const att of attachments) {
      if (att.type === 'image' && att.data) {
        contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: att.mimeType || 'image/png', data: att.data } });
      }
    }
    prompt = { type: 'user', message: { role: 'user', content: contentBlocks } };
  } else {
    prompt = message || '[Empty message]';
  }

  activeController = new AbortController();
  options.signal = activeController.signal;

  try {
    const query = sdk.query({ prompt, options });
    for await (const msg of query) {
      send({ type: 'stream', data: msg });
      if (msg.type === 'system' && msg.session_id) currentSessionId = msg.session_id;
      if (msg.type === 'assistant' && msg.message?.usage) {
        const u = msg.message.usage;
        totalInputTokens += u.input_tokens || 0;
        totalOutputTokens += u.output_tokens || 0;
      }
      if (msg.type === 'result') {
        const cost = msg.total_cost_usd || 0;
        totalCost += cost;
        send({
          type: 'result', success: !msg.is_error,
          sessionId: currentSessionId, costUsd: cost,
          usage: msg.usage, durationMs: msg.duration_ms,
          result: msg.result, isError: msg.is_error,
        });
        break;
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      send({ type: 'result', success: false, error: 'User interrupted' });
    } else {
      send({ type: 'error', message: error.message, stack: error.stack?.slice(0, 500) });
    }
  } finally {
    activeController = null;
    clearAllPendingPermissions();
  }
}

// ── Codex send ────────────────────────────────────────────────────────────
async function processCodex(params) {
  const {
    message, cwd, model, permissionMode = 'default',
    threadId, attachments, reasoningEffort = 'medium',
    apiKey, baseUrl,
  } = params;

  if (!codexHandlerModule) {
    try {
      // dynamic import so bridge starts even if codex-sdk not installed yet
      const { processCodexEventStream, createInitialEventState } = await import('./codex/codex-handler.js');
      const { codexPermissionConfig } = await import('./codex/permission-mapper.js');
      codexHandlerModule = { processCodexEventStream, createInitialEventState, codexPermissionConfig };
    } catch (e) {
      send({ type: 'error', message: `Codex handler import failed: ${e.message}` });
      return;
    }
  }

  let CodexSdk;
  try {
    const mod = await import('@openai/codex-sdk');
    CodexSdk = mod.Codex || mod.default || mod;
  } catch (e) {
    send({ type: 'error', message: `@openai/codex-sdk not installed. Run: npm install in cc-bridge directory. (${e.message})` });
    return;
  }

  const { processCodexEventStream, createInitialEventState, codexPermissionConfig } = codexHandlerModule;
  const permConfig = codexPermissionConfig(permissionMode);

  const codexOptions = {};
  if (baseUrl) codexOptions.baseUrl = baseUrl;
  if (apiKey) codexOptions.apiKey = apiKey;

  // Sanitize env: strip CODEX_* override vars that could pollute approval policy
  const BLOCKLIST = new Set(['CODEX_APPROVAL_POLICY','CODEX_SANDBOX_MODE','CODEX_SANDBOX','CODEX_CI']);
  const cliEnv = Object.fromEntries(Object.entries(process.env).filter(([k, v]) => v && !BLOCKLIST.has(k)));
  codexOptions.env = cliEnv;

  const codex = new CodexSdk(codexOptions);

  const threadOptions = {
    skipGitRepoCheck: permConfig.skipGitRepoCheck,
    maxTurns: 200,
  };
  if (permConfig.approvalPolicy) threadOptions.approvalPolicy = permConfig.approvalPolicy;
  if (permConfig.sandbox) threadOptions.sandboxMode = permConfig.sandbox;
  if (reasoningEffort?.trim()) threadOptions.modelReasoningEffort = reasoningEffort;

  const isResumingThread = !!(threadId?.trim());
  if (!isResumingThread && cwd?.trim()) threadOptions.workingDirectory = cwd;
  if (model?.trim()) threadOptions.model = model;

  const thread = isResumingThread
    ? codex.resumeThread(threadId, threadOptions)
    : codex.startThread(threadOptions);

  let runInput;
  if (attachments?.length > 0) {
    runInput = [{ type: 'text', text: message }];
    for (const att of attachments) {
      if (att.type === 'local_image' && att.path) runInput.push({ type: 'local_image', path: att.path });
    }
  } else {
    runInput = message || '[Empty message]';
  }

  const turnAbortController = new AbortController();
  activeController = turnAbortController;

  try {
    const { events } = await thread.runStreamed(runInput, { signal: turnAbortController.signal });

    const emitMessage = (msg) => send({ type: 'stream', data: msg });
    const state = createInitialEventState(emitMessage);

    await processCodexEventStream(events, state, {
      approvalPolicy: threadOptions.approvalPolicy,
      requestPermission, // bridges via stdout permission_request
      turnAbortController,
    });

    send({
      type: 'result', success: true,
      threadId: state.currentThreadId || threadId,
      result: state.finalResponse,
    });
  } catch (error) {
    if (error.name === 'AbortError' || error.message?.includes('User interrupted')) {
      send({ type: 'result', success: false, error: 'User interrupted' });
    } else {
      send({ type: 'error', message: error.message, stack: error.stack?.slice(0, 500) });
    }
  } finally {
    activeController = null;
    clearAllPendingPermissions();
  }
}

// ── Request handler ───────────────────────────────────────────────────────
async function processRequest(request) {
  const { id, method, params = {} } = request;

  if (method === 'heartbeat') {
    send({ id: id || '0', type: 'heartbeat', ts: Date.now() });
    return;
  }
  if (method === 'status') {
    send({ id, type: 'status', pid: process.pid, uptime: process.uptime(), sessionId: currentSessionId, totalCost, totalInputTokens, totalOutputTokens });
    return;
  }
  if (method === 'abort') {
    if (activeController) activeController.abort();
    clearAllPendingPermissions('aborted');
    send({ id: id || '0', done: true, success: true });
    return;
  }
  if (method === 'permission_response') {
    handlePermissionResponse(params.toolUseId, params.behavior);
    send({ id: id || '0', done: true, success: true });
    return;
  }
  if (method === 'send') {
    try {
      const engine = params.engine || 'claude';
      if (engine === 'codex') {
        await processCodex(params);
      } else {
        await processClaude(params);
      }
      send({ id, done: true, success: true });
    } catch (error) {
      send({ id, done: true, success: false, error: error.message });
    }
    return;
  }
  send({ id, done: true, success: false, error: `Unknown method: ${method}` });
}

// ── Main ──────────────────────────────────────────────────────────────────
process.stdout.write = function (chunk, encoding, callback) {
  const text = typeof chunk === 'string' ? chunk : chunk.toString(encoding || 'utf8');
  if (text.trim() && !text.trim().startsWith('{')) {
    process.stderr.write(`[bridge] stdout intercept: ${text.slice(0, 200)}\n`);
  }
  if (typeof callback === 'function') callback();
  return true;
};

process.on('uncaughtException', (error) => {
  process.stderr.write(`[bridge] Uncaught: ${error.message}\n${error.stack}\n`);
  send({ type: 'error', message: `Uncaught: ${error.message}` });
});
process.on('unhandledRejection', (reason) => {
  process.stderr.write(`[bridge] Unhandled rejection: ${String(reason)}\n`);
  send({ type: 'error', message: `Unhandled rejection: ${String(reason)}` });
});

const initialPpid = process.ppid;
setInterval(() => {
  try { process.kill(initialPpid, 0); } catch { process.exit(0); }
}, 3000).unref();

sendDaemonEvent('starting', { pid: process.pid, nodeVersion: process.version });

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
let commandQueue = Promise.resolve();

rl.on('line', (line) => {
  if (!line.trim()) return;
  let request;
  try { request = JSON.parse(line); } catch {
    process.stderr.write(`[bridge] Invalid JSON: ${line.slice(0, 200)}\n`);
    return;
  }
  if (['heartbeat', 'status', 'abort', 'permission_response'].includes(request.method)) {
    processRequest(request);
    return;
  }
  commandQueue = commandQueue
    .then(() => processRequest(request))
    .catch((e) => process.stderr.write(`[bridge] Queue error: ${e.message}\n`));
});

rl.on('close', () => {
  if (activeController) activeController.abort();
  sendDaemonEvent('shutdown', { reason: 'stdin_closed' });
  setTimeout(() => process.exit(0), 500);
});

sendDaemonEvent('ready', { pid: process.pid });
