// session.ts — 会话相关类型

export interface ClaudeSession {
  session_id: string;
  project: string;
  summary: string;
  modified?: number;
}

export interface FileEntry {
  path: string;
  full_path: string;
  is_dir: boolean;
  size: number;
}

export interface SkillDef {
  name: string;
  description: string;
  path: string;
}

export interface FavoriteItem {
  id: string;
  name: string;
  message: string;
}

export interface SessionRecord {
  sessionId: string;
  project: string;
  summary: string;
  startedAt?: number;
  endedAt: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  messageCount: number;
  model: string;
}
