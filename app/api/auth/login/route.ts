import { NextResponse } from "next/server";
import { setOwnerCookie, verifyOwnerPassword } from "@/lib/auth";
import { ownerCredentialsConfigured } from "@/lib/config";
import { getClientIp, redirectTo, sameOrigin } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return redirectTo(request, "/login?e=origin");
  const ip = getClientIp(request);
  const limit = rateLimit(`login:${ip}`, 10, 60_000);
  if (!limit.ok) return redirectTo(request, "/login?e=slow");

  if (!ownerCredentialsConfigured()) return redirectTo(request, "/login?e=config");

  let password = "";
  try {
    const form = await request.formData();
    password = String(form.get("password") ?? "");
  } catch {
    return redirectTo(request, "/login?e=bad");
  }

  if (!(await verifyOwnerPassword(password))) {
    return redirectTo(request, "/login?e=wrong");
  }

  await setOwnerCookie();
  return redirectTo(request, "/");
}
