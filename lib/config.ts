import path from "node:path";

const rawDataDir = process.env.DATA_DIR?.trim();

export const config = {
  dataDir: rawDataDir ? path.resolve(rawDataDir) : path.join(process.cwd(), "data"),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, ""),
  maxAudioBytes: Number(process.env.MAX_AUDIO_BYTES ?? 524_288_000),
  secureCookies:
    process.env.COOKIE_SECURE === "false" ? false : process.env.NODE_ENV === "production",
  isProduction: process.env.NODE_ENV === "production",
} as const;

export const paths = {
  audio: path.join(config.dataDir, "audio"),
  tmp: path.join(config.dataDir, "tmp"),
  db: path.join(config.dataDir, "db"),
  cache: path.join(config.dataDir, "cache"),
} as const;

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 16) return secret;
  if (config.isProduction) {
    throw new Error(
      "SESSION_SECRET не задан или короче 16 символов. Задайте длинную случайную строку в переменных окружения.",
    );
  }
  return "dev-only-insecure-session-secret-change-me";
}

export function ownerCredentialsConfigured(): boolean {
  return Boolean(process.env.OWNER_PASSWORD_HASH?.trim() || process.env.OWNER_PASSWORD?.trim());
}

export function ingestConfigured(): boolean {
  return Boolean(process.env.INGEST_TOKEN?.trim());
}

export function publicBaseUrl(): string {
  return config.publicBaseUrl;
}

/** Сервис, который умеет /v1/ask (Claude). Ключ Anthropic не покидает этот сервис. */
export function askServiceConfig(): { baseUrl: string; token: string } | null {
  const baseUrl = (process.env.TRANSCRIBE_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const token = (process.env.TRANSCRIBE_TOKEN ?? "").trim();
  if (!baseUrl || !token) return null;
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return { baseUrl, token };
}

export function askConfigured(): boolean {
  return askServiceConfig() != null;
}
