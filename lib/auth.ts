import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { config, ownerCredentialsConfigured, sessionSecret } from "@/lib/config";
import { packSigned, safeEqualStrings, sha256, unpackSigned, verifyPassword } from "@/lib/crypto";
import { NO_STORE } from "@/lib/http";

const OWNER_COOKIE = "air_owner";
const OWNER_SESSION_MS = 30 * 86_400_000;
const SHARE_SESSION_MS = 7 * 86_400_000;

export async function verifyOwnerPassword(password: string): Promise<boolean> {
  if (!password || password.length > 500) return false;
  const hash = process.env.OWNER_PASSWORD_HASH?.trim();
  if (hash) return verifyPassword(password, hash);
  const plain = process.env.OWNER_PASSWORD?.trim();
  if (!plain) return false;
  return safeEqualStrings(sha256(password), sha256(plain));
}

export function ownerCookieValue(expiresAtMs: number, secret: string): string {
  return packSigned(`owner:${expiresAtMs}`, secret);
}

export async function setOwnerCookie(): Promise<void> {
  const expiresAtMs = Date.now() + OWNER_SESSION_MS;
  const store = await cookies();
  store.set(OWNER_COOKIE, ownerCookieValue(expiresAtMs, sessionSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookies,
    path: "/",
    maxAge: Math.floor(OWNER_SESSION_MS / 1000),
  });
}

export async function clearOwnerCookie(): Promise<void> {
  const store = await cookies();
  store.set(OWNER_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookies,
    path: "/",
    maxAge: 0,
  });
}

export async function isOwner(): Promise<boolean> {
  const store = await cookies();
  const value = store.get(OWNER_COOKIE)?.value;
  let secret: string;
  try {
    secret = sessionSecret();
  } catch {
    return false;
  }
  const payload = unpackSigned(value, secret);
  if (!payload?.startsWith("owner:")) return false;
  const expiresAtMs = Number(payload.slice("owner:".length));
  return Number.isFinite(expiresAtMs) && expiresAtMs > Date.now();
}

export async function requireOwnerPage(): Promise<void> {
  if (!(await isOwner())) redirect("/login");
}

export async function requireOwnerApi(): Promise<NextResponse | null> {
  if (await isOwner()) return null;
  return NextResponse.json(
    { error: { code: "unauthorized", message: "Нужен вход владельца" } },
    { status: 401, headers: NO_STORE },
  );
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function checkIngestAuth(request: Request): NextResponse | null {
  const expected = process.env.INGEST_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json(
      {
        error: {
          code: "not_configured",
          message: "INGEST_TOKEN не задан на сервере",
        },
      },
      { status: 503, headers: NO_STORE },
    );
  }
  const token = getBearerToken(request);
  if (!token || !safeEqualStrings(sha256(token), sha256(expected))) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Неверный токен" } },
      {
        status: 401,
        headers: { ...NO_STORE, "WWW-Authenticate": 'Bearer realm="airecorder"' },
      },
    );
  }
  return null;
}

export function shareCookieName(token: string): string {
  return `air_s_${sha256(token).slice(0, 12)}`;
}

export function shareCookieValue(shareId: string, expiresAtMs: number, secret: string): string {
  return packSigned(`share:${shareId}:${expiresAtMs}`, secret);
}

export async function setShareCookie(
  token: string,
  shareId: string,
  linkExpiresAtMs: number | null,
): Promise<void> {
  const now = Date.now();
  const expiresAtMs = Math.min(now + SHARE_SESSION_MS, linkExpiresAtMs ?? Number.POSITIVE_INFINITY);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) return;
  const store = await cookies();
  store.set(shareCookieName(token), shareCookieValue(shareId, expiresAtMs, sessionSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookies,
    path: "/",
    maxAge: Math.max(1, Math.floor((expiresAtMs - now) / 1000)),
  });
}

export async function clearShareCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(shareCookieName(token), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookies,
    path: "/",
    maxAge: 0,
  });
}

export async function hasShareAccess(token: string, shareId: string): Promise<boolean> {
  const store = await cookies();
  const value = store.get(shareCookieName(token))?.value;
  let secret: string;
  try {
    secret = sessionSecret();
  } catch {
    return false;
  }
  const payload = unpackSigned(value, secret);
  if (!payload?.startsWith("share:")) return false;
  const rest = payload.slice("share:".length);
  const separator = rest.lastIndexOf(":");
  if (separator <= 0) return false;
  const payloadShareId = rest.slice(0, separator);
  const expiresAtMs = Number(rest.slice(separator + 1));
  return payloadShareId === shareId && Number.isFinite(expiresAtMs) && expiresAtMs > Date.now();
}

export function ownerSetupWarning(): string | null {
  if (!ownerCredentialsConfigured()) {
    return "Не задан пароль владельца: добавьте OWNER_PASSWORD или OWNER_PASSWORD_HASH.";
  }
  if (config.isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16)) {
    return "Не задан SESSION_SECRET: без него не работают вход и ссылки.";
  }
  return null;
}
