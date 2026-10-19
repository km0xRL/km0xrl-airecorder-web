import { NextResponse } from "next/server";

export const NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;

export function jsonResponse(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...NO_STORE,
      "Content-Type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

export function apiError(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): NextResponse {
  return jsonResponse({ error: { code, message }, ...(extra ?? {}) }, { status });
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function hostFromUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const requestHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    hostFromUrl(request.url);
  const allowed = new Set<string>();
  if (requestHost) allowed.add(requestHost.toLowerCase());
  const configured = hostFromUrl(process.env.PUBLIC_BASE_URL);
  if (configured) allowed.add(configured);
  const originHost = hostFromUrl(origin);
  return Boolean(originHost && allowed.has(originHost));
}

export async function readTextLimited(request: Request, maxBytes: number): Promise<string> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > maxBytes) {
    throw new PayloadTooLargeError();
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new PayloadTooLargeError();
  return text;
}

export class PayloadTooLargeError extends Error {
  constructor() {
    super("Слишком большой запрос");
    this.name = "PayloadTooLargeError";
  }
}

/**
 * Публичный origin запроса. За обратным прокси Railway `request.url` может быть
 * внутренним (http://0.0.0.0:8080), поэтому сначала смотрим forwarded-заголовки.
 */
export function requestOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const rawHost = request.headers.get("host")?.trim();
  const hostHeader =
    rawHost && !/^(0\.0\.0\.0|127\.0\.0\.1)(:\d+)?$/.test(rawHost) ? rawHost : null;
  const configured = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
  let configuredHost: string | null = null;
  let configuredProto: string | null = null;
  if (configured) {
    try {
      const url = new URL(configured);
      configuredHost = url.host;
      configuredProto = url.protocol.replace(":", "");
    } catch {
      configuredHost = null;
    }
  }
  const host =
    forwardedHost || hostHeader || configuredHost || new URL(request.url).host;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    configuredProto ||
    new URL(request.url).protocol.replace(":", "") ||
    "http";
  return `${proto}://${host}`;
}

export function redirectTo(request: Request, path: string, status = 303): NextResponse {
  return NextResponse.redirect(new URL(path, requestOrigin(request)), status);
}

export function safeFileName(input: string | null | undefined, fallback = "audio"): string {
  const cleaned = (input ?? "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return cleaned || fallback;
}

export function contentDispositionInline(fileName: string): string {
  const ascii = safeFileName(fileName, "audio").replace(/[^\x20-\x7e]/g, "_");
  const encoded = encodeURIComponent(safeFileName(fileName, "audio"));
  return `inline; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export function contentDispositionAttachment(fileName: string): string {
  const ascii = safeFileName(fileName, "file").replace(/[^\x20-\x7e]/g, "_");
  const encoded = encodeURIComponent(safeFileName(fileName, "file"));
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export function absoluteUrl(request: Request, path: string): string {
  const base = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (base) return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return new URL(path, requestOrigin(request)).toString();
}
