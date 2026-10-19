import { NextResponse } from "next/server";
import { checkIngestAuth } from "@/lib/auth";
import { apiError, jsonResponse } from "@/lib/http";
import { getLibraryChanges } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const unauthorized = checkIngestAuth(request);
  if (unauthorized) return unauthorized;
  const url = new URL(request.url);
  const sinceRaw = url.searchParams.get("since");
  const limitRaw = url.searchParams.get("limit");
  const since = sinceRaw != null ? Number(sinceRaw) : 0;
  const limit = limitRaw != null ? Number(limitRaw) : 50;
  if (!Number.isFinite(since) || since < 0) return apiError(400, "bad_since", "since — номер изменения");
  if (!Number.isFinite(limit)) return apiError(400, "bad_limit", "limit — число от 1 до 200");
  return jsonResponse(getLibraryChanges(since, limit));
}
