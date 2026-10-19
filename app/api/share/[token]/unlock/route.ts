import { NextResponse } from "next/server";
import { hasShareAccess, setShareCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/crypto";
import { getClientIp, redirectTo, sameOrigin } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { getShareByToken, getShareRow, shareStatus, touchShare } from "@/lib/recordings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await context.params;
  if (!sameOrigin(request)) return redirectTo(request, `/s/${token}?e=wrong`);

  const share = getShareByToken(token);
  if (!share || shareStatus(share) !== "active") {
    return redirectTo(request, `/s/${token}?e=gone`);
  }

  const ip = getClientIp(request);
  const limit = rateLimit(`share-unlock:${ip}:${share.id}`, 8, 60_000);
  if (!limit.ok) return redirectTo(request, `/s/${token}?e=slow`);

  let password = "";
  try {
    const form = await request.formData();
    password = String(form.get("password") ?? "");
  } catch {
    return redirectTo(request, `/s/${token}?e=wrong`);
  }

  const row = getShareRow(share.id);
  if (!row) return redirectTo(request, `/s/${token}?e=gone`);
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return redirectTo(request, `/s/${token}?e=wrong`);

  await setShareCookie(token, share.id, share.expiresAtMs);
  touchShare(share.id);
  return redirectTo(request, `/s/${token}`);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await context.params;
  return redirectTo(request, `/s/${token}`);
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  return GET(request, context);
}

// hasShareAccess импортируется для единообразия проверок в других route-файлах.
void hasShareAccess;
