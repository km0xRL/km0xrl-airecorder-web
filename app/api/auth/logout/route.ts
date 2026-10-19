import { NextResponse } from "next/server";
import { clearOwnerCookie } from "@/lib/auth";
import { redirectTo, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return redirectTo(request, "/login?e=origin");
  await clearOwnerCookie();
  return redirectTo(request, "/login");
}

export async function GET(request: Request): Promise<NextResponse> {
  return redirectTo(request, "/login");
}
