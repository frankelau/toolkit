// settingsExport — 设置导入/导出工具
// 将当前所有设置导出为 JSON 文件，支持一键恢复

export interface SettingsProfile {
  version: number;
  exportedAt: string;
  engine: "claude" | "codex";
  model: string;
  cwd: string;
  systemPrompt: string;
  mcpConfig: string;
  permissionMode: string;
  streamingEnabled: boolean;
  thinkingEnabled: boolean;
  providerId: string;
  providerBaseUrl: string;
  appearance?: Record<string, string | number>;
  favorites: Array<{ id: string; name: string; message: string }>;
}

export function exportSettings(settings: Partial<SettingsProfile>): string {
  const profile: SettingsProfile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    engine: "claude",
    model: "",
    cwd: "",
    systemPrompt: "",
    mcpConfig: "{}",
    permissionMode: "default",
    streamingEnabled: true,
    thinkingEnabled: true,
    providerId: "official",
    providerBaseUrl: "",
    favorites: [],
    ...settings,
  };
  return JSON.stringify(profile, null, 2);
}

export function importSettings(json: string): SettingsProfile | null {
  try {
    const data = JSON.parse(json);
    if (typeof data.version !== "number") return null;
    return data as SettingsProfile;
  } catch {
    return null;
  }
}

export function exportSettingsToFile(settings: Partial<SettingsProfile>): void {
  const json = exportSettings(settings);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ccagent-settings-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importSettingsFromFile(): Promise<SettingsProfile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => {
        resolve(importSettings(reader.result as string));
      };
      reader.readAsText(file);
    };
    input.click();
  });
}
