/**
 * Codex permission mapping: unified permission mode → Codex sandbox/approval config.
 * Ported from ccgui (utils/permission-mapper.js), self-contained.
 *
 * Unified modes (from frontend): 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'
 */

import { platform } from 'os';

function isWindows() {
  return platform() === 'win32';
}

function normalizeUnifiedMode(mode) {
  if (!mode) return { core: 'default' };
  const normalized = mode.toString().trim().toLowerCase();
  if (normalized === 'bypasspermissions') return { core: 'yolo', alias: 'bypassPermissions' };
  if (normalized === 'acceptedits' || normalized === 'autoedit') return { core: 'default', alias: 'acceptEdits' };
  if (normalized === 'plan' || normalized === 'sandbox') return { core: 'sandbox' };
  if (normalized === 'yolo') return { core: 'yolo' };
  return { core: 'default' };
}

/**
 * Convert unified permission mode to Codex thread config.
 * @returns {{skipGitRepoCheck:boolean, sandbox:string, approvalPolicy:string}}
 */
export function codexPermissionConfig(unifiedMode) {
  const { core, alias } = normalizeUnifiedMode(unifiedMode);
  const onWindows = isWindows();

  if (alias === 'bypassPermissions') {
    return { skipGitRepoCheck: true, sandbox: onWindows ? 'danger-full-access' : 'workspace-write', approvalPolicy: 'never' };
  }
  if (alias === 'acceptEdits') {
    return { skipGitRepoCheck: true, sandbox: onWindows ? 'danger-full-access' : 'workspace-write', approvalPolicy: 'on-request' };
  }
  switch (core) {
    case 'sandbox':
      return { skipGitRepoCheck: true, sandbox: 'read-only', approvalPolicy: 'untrusted' };
    case 'yolo':
      return { skipGitRepoCheck: true, sandbox: 'danger-full-access', approvalPolicy: 'never' };
    case 'default':
    default:
      return { skipGitRepoCheck: true, sandbox: onWindows ? 'danger-full-access' : 'workspace-write', approvalPolicy: 'untrusted' };
  }
}

export function isAutoEditPermissionMode(mode) {
  const normalized = (mode || '').toString().trim().toLowerCase();
  return normalized === 'acceptedits' || normalized === 'autoedit' || normalized === 'bypasspermissions' || normalized === 'yolo';
}
