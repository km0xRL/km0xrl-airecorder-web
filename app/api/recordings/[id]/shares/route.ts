import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { absoluteUrl, apiError, jsonResponse, readTextLimited, sameOrigin } from "@/lib/http";
import { hashPassword, randomPassword } from "@/lib/crypto";
import { createShare, getRecording, listSharesForRecording, shareStatus } from "@/lib/recordings";
import type { ShareLink } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function shareView(share: ShareLink, request: Request) {
  return {
    ...share,
    status: shareStatus(share),
    url: absoluteUrl(request, `/s/${share.token}`),
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireOwnerApi();
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  if (!getRecording(id)) return apiError(404, "not_found", "Запись не найдена");
  return jsonResponse({ shares: listSharesForRecording(id).map((share) => shareView(share, request)) });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireOwnerApi();
  if (unauthorized) return unauthorized;
  if (!sameOrigin(request)) return apiError(403, "bad_origin", "Чужой источник запроса");
  const { id } = await context.params;
  if (!getRecording(id)) return apiError(404, "not_found", "Запись не найдена");

  let body: unknown;
  try {
    body = JSON.parse(await readTextLimited(request, 16 * 1024));
  } catch {
    return apiError(400, "bad_json", "Неверный JSON");
  }
  const input = (body ?? {}) as { label?: unknown; password?: unknown; expiresInDays?: unknown };

  let label: string | null = null;
  if (input.label !== undefined && input.label !== null) {
    if (typeof input.label !== "string") return apiError(400, "bad_label", "Название должно быть строкой");
    label = input.label.trim().slice(0, 80) || null;
  }

  let password: string;
  if (input.password === undefined || input.password === null || input.password === "") {
    password = randomPassword(10);
  } else {
    if (typeof input.password !== "string") return apiError(400, "bad_password", "Пароль должен быть строкой");
    password = input.password.trim();
    if (password.length < 4) return apiError(400, "bad_password", "Пароль короче 4 символов");
    if (password.length > 128) return apiError(400, "bad_password", "Пароль длиннее 128 символов");
  }

  let expiresAtMs: number | null = null;
  if (input.expiresInDays !== undefined && input.expiresInDays !== null) {
    const days = Number(input.expiresInDays);
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      return apiError(400, "bad_expiry", "Срок — от 1 до 3650 дней или null");
    }
    expiresAtMs = Date.now() + Math.round(days * 86_400_000);
  }

  const share = createShare({
    recordingId: id,
    passwordHash: await hashPassword(password),
    label,
    expiresAtMs,
  });

  return jsonResponse(
    {
      share: shareView(share, request),
      password,
      url: absoluteUrl(request, `/s/${share.token}`),
    },
    { status: 201 },
  );
}
