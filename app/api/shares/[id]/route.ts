import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { hashPassword, randomPassword } from "@/lib/crypto";
import { absoluteUrl, apiError, jsonResponse, readTextLimited, sameOrigin } from "@/lib/http";
import {
  getShareById,
  restoreShare,
  revokeShare,
  setShareExpiry,
  setShareLabel,
  setSharePassword,
  shareStatus,
} from "@/lib/recordings";
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireOwnerApi();
  if (unauthorized) return unauthorized;
  if (!sameOrigin(request)) return apiError(403, "bad_origin", "Чужой источник запроса");

  const { id } = await context.params;
  const existing = getShareById(id);
  if (!existing) return apiError(404, "not_found", "Ссылка не найдена");

  let body: unknown;
  try {
    body = JSON.parse(await readTextLimited(request, 16 * 1024));
  } catch {
    return apiError(400, "bad_json", "Неверный JSON");
  }
  const input = (body ?? {}) as {
    regenerate?: unknown;
    password?: unknown;
    expiresInDays?: unknown;
    label?: unknown;
    restore?: unknown;
  };

  let generatedPassword: string | null = null;
  let share: ShareLink | null = existing;

  if (input.restore === true) {
    share = restoreShare(id);
  }

  if (input.regenerate === true || input.password !== undefined) {
    let password: string;
    if (typeof input.password === "string") {
      password = input.password.trim();
      if (password.length < 4) return apiError(400, "bad_password", "Пароль короче 4 символов");
      if (password.length > 128) return apiError(400, "bad_password", "Пароль длиннее 128 символов");
    } else {
      password = randomPassword(10);
      generatedPassword = password;
    }
    share = setSharePassword(id, await hashPassword(password));
  }

  if (input.expiresInDays !== undefined) {
    if (input.expiresInDays === null) {
      share = setShareExpiry(id, null);
    } else {
      const days = Number(input.expiresInDays);
      if (!Number.isFinite(days) || days < 1 || days > 3650) {
        return apiError(400, "bad_expiry", "Срок — от 1 до 3650 дней или null");
      }
      share = setShareExpiry(id, Date.now() + Math.round(days * 86_400_000));
    }
  }

  if (input.label !== undefined) {
    if (input.label !== null && typeof input.label !== "string") {
      return apiError(400, "bad_label", "Название должно быть строкой");
    }
    share = setShareLabel(id, typeof input.label === "string" ? input.label.trim().slice(0, 80) || null : null);
  }

  if (!share) return apiError(404, "not_found", "Ссылка не найдена");
  return jsonResponse({
    share: shareView(share, request),
    ...(generatedPassword ? { password: generatedPassword } : {}),
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireOwnerApi();
  if (unauthorized) return unauthorized;
  if (!sameOrigin(request)) return apiError(403, "bad_origin", "Чужой источник запроса");
  const { id } = await context.params;
  const existing = getShareById(id);
  if (!existing) return apiError(404, "not_found", "Ссылка не найдена");
  const share = revokeShare(id);
  if (!share) return apiError(404, "not_found", "Ссылка не найдена");
  return jsonResponse({ share: shareView(share, request) });
}
