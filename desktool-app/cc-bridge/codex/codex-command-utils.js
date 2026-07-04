/**
 * Command classification helpers for Codex (pure, ported from ccgui).
 */

export function truncateForDisplay(text, maxChars) {
  if (typeof text !== 'string') return String(text ?? '');
  if (maxChars <= 0 || text.length <= maxChars) return text;
  const head = Math.max(0, Math.floor(maxChars * 0.65));
  const tail = Math.max(0, maxChars - head);
  const prefix = text.slice(0, head);
  const suffix = tail > 0 ? text.slice(Math.max(0, text.length - tail)) : '';
  return `${prefix}\n...\n(truncated, original length: ${text.length} chars)\n...\n${suffix}`;
}

export function getStableItemId(item) {
  if (!item || typeof item !== 'object') return null;
  const candidate = item.id ?? item.item_id ?? item.uuid;
  return typeof candidate === 'string' && candidate.trim() ? candidate : null;
}

export function extractCommand(item) {
  const cmd = item?.command;
  if (typeof cmd === 'string') return cmd;
  if (Array.isArray(cmd)) return cmd.join(' ');
  return '';
}

export function extractActualCommand(command) {
  if (!command || typeof command !== 'string') return command;
  let cmd = command.trim();
  const shellWrapperMatch = cmd.match(/^\/bin\/(zsh|bash)\s+(?:-lc|-c)\s+['"](.+)['"]$/);
  if (shellWrapperMatch) cmd = shellWrapperMatch[2];
  const cdPrefixMatch = cmd.match(/^cd\s+\S+\s+&&\s+(.+)$/);
  if (cdPrefixMatch) cmd = cdPrefixMatch[1];
  return cmd.trim();
}

export function smartToolName(command) {
  if (!command || typeof command !== 'string') return 'bash';
  const actualCmd = extractActualCommand(command);
  if (/^(ls|find|tree)\b/.test(actualCmd)) return 'glob';
  if (/^(pwd|cat|head|tail|file|stat)\b/.test(actualCmd)) return 'read';
  if (/^sed\s+-n\s+/.test(actualCmd)) return 'read';
  if (/^(grep|rg|ack|ag)\b/.test(actualCmd)) return 'glob';
  return 'bash';
}

export function smartDescription(command) {
  if (!command || typeof command !== 'string') return 'Execute command';
  const actualCmd = extractActualCommand(command);
  const firstWord = actualCmd.split(/\s+/)[0];
  if (/^ls\b/.test(actualCmd)) return 'List directory contents';
  if (/^pwd\b/.test(actualCmd)) return 'Show current directory';
  if (/^cat\b/.test(actualCmd)) return 'Read file contents';
  if (/^head\b/.test(actualCmd)) return 'Read first lines';
  if (/^tail\b/.test(actualCmd)) return 'Read last lines';
  if (/^find\b/.test(actualCmd)) return 'Find files';
  if (/^tree\b/.test(actualCmd)) return 'Show directory tree';
  if (/^sed\s+-n\s+/.test(actualCmd)) return 'Read file lines';
  if (/^(grep|rg|ack|ag)\b/.test(actualCmd)) return 'Search in files';
  if (/^git\s+status\b/.test(actualCmd)) return 'Check git status';
  if (/^git\s+diff\b/.test(actualCmd)) return 'Show git diff';
  if (/^git\s+log\b/.test(actualCmd)) return 'Show git log';
  if (/^git\s+add\b/.test(actualCmd)) return 'Stage changes';
  if (/^git\s+commit\b/.test(actualCmd)) return 'Commit changes';
  if (/^git\s+push\b/.test(actualCmd)) return 'Push to remote';
  if (/^git\s+pull\b/.test(actualCmd)) return 'Pull from remote';
  if (/^git\s+/.test(actualCmd)) return `Run git ${actualCmd.substring(4).split(/\s+/)[0]}`;
  if (/^npm\s+install\b/.test(actualCmd)) return 'Install npm packages';
  if (/^npm\s+run\b/.test(actualCmd)) return 'Run npm script';
  if (/^npm\s+/.test(actualCmd)) return `Run npm ${actualCmd.substring(4).split(/\s+/)[0]}`;
  if (/^(yarn|pnpm)\s+/.test(actualCmd)) return `Run ${firstWord} command`;
  if (/^(gradle|mvn|make)\b/.test(actualCmd)) return `Run ${firstWord} build`;
  return actualCmd.length <= 30 ? actualCmd : `Run ${firstWord}`;
}

export function mapCommandToolNameToPermissionToolName(toolName) {
  if (toolName === 'read') return 'Read';
  if (toolName === 'glob') return 'Glob';
  return 'Bash';
}

// ── Tool invocation signature tracking (dedup tool_use ids) ──

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function buildToolInvocationSignature(name, input) {
  if (typeof name !== 'string' || !name) return '';
  return `${name}::${stableStringify(input && typeof input === 'object' ? input : {})}`;
}
