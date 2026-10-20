import { NextResponse } from "next/server";
import { checkIngestAuth } from "@/lib/auth";
import { hashPassword, randomPassword } from "@/lib/crypto";
import { absoluteUrl, apiError, getClientIp, jsonResponse, readTextLimited } from "@/lib/http";
import { createShare, getRecordingByClientId } from "@/lib/recordings";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Создать ссылку для получателя из приложения (Bearer INGEST_TOKEN).
 * Пароль генерируется здесь и возвращается один раз; URL приложение строит от своего адреса сайта.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
): Promise<NextResponse> {
  const unauthorized = checkIngestAuth(request);
  if (unauthorized) return unauthorized;

  const limit = rateLimit(`share:${getClientIp(request)}`, 20, 60_000);
  if (!limit.ok) {
    return apiError(429, "rate_limited", "Слишком много ссылок подряд — подождите минуту", {
      retry_after_s: limit.retryAfterSec,
    });
  }

  const { clientId } = await context.params;
  const recording = getRecordingByClientId(clientId);
  if (!recording) return apiError(404, "not_found", "Сначала синхронизируйте запись с сайтом");

  let days = 30;
  try {
    const raw = await readTextLimited(request, 8 * 1024);
    if (raw.trim()) {
      const body = JSON.parse(raw) as { expiresInDays?: unknown };
      if (body.expiresInDays !== undefined) {
        const value = Number(body.expiresInDays);
        if (!Number.isFinite(value) || value < 1 || value > 3650) {
          return apiError(400, "bad_expiry", "Срок — от 1 до 3650 дней");
        }
        days = Math.round(value);
      }
    }
  } catch {
    return apiError(400, "bad_json", "Неверный JSON");
  }

  const password = randomPassword(10);
  const expiresAtMs = Date.now() + days * 86_400_000;
  const share = createShare({
    recordingId: recording.id,
    passwordHash: await hashPassword(password),
    label: "Из приложения",
    expiresAtMs,
  });

  return jsonResponse(
    {
      id: share.id,
      token: share.token,
      password,
      expiresAtMs,
      url: absoluteUrl(request, `/s/${share.token}`),
    },
    { status: 201 },
  );
}
