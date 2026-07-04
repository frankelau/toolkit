// redact.ts — 密钥脱敏

export function redactSecrets(text: string): string {
  return text
    .replace(/sk-[a-zA-Z0-9]{20,}/g, "sk-***REDACTED***")
    .replace(/ghp_[a-zA-Z0-9]{36}/g, "ghp_***REDACTED***")
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "Bearer ***REDACTED***")
    .replace(/Authorization:\s*Bearer\s+[^\s]+/gi, "Authorization: Bearer ***REDACTED***");
}
