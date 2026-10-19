import { NextResponse } from "next/server";
import { checkIngestAuth } from "@/lib/auth";
import { apiError, jsonResponse } from "@/lib/http";
import { listRecordingsForSync } from "@/lib/recordings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const unauthorized = checkIngestAuth(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const sinceRaw = url.searchParams.get("since");
  const limitRaw = url.searchParams.get("limit");
  const since = sinceRaw != null ? Number(sinceRaw) : 0;
  const limit = limitRaw != null ? Number(limitRaw) : 100;
  if (!Number.isFinite(since) || since < 0) return apiError(400, "bad_since", "since — миллисекунды эпохи");
  if (!Number.isFinite(limit)) return apiError(400, "bad_limit", "limit — число от 1 до 500");

  const items = listRecordingsForSync(Math.round(since), Math.round(limit));
  const next = items.length
    ? Math.max(...items.map((item) => item.updatedAtMs))
    : Math.round(since);
  return jsonResponse({
    items: items.map((item) => ({
      id: item.clientId,
      title: item.title,
      kind: item.kind,
      recorded_at_ms: item.recordedAtMs,
      duration_s: item.durationS,
      updated_at_ms: item.updatedAtMs,
      deleted: item.deleted,
      has_audio: item.hasAudio && !item.deleted,
      has_transcript: item.hasTranscript,
      has_report: item.hasReport,
    })),
    next,
    more: items.length >= Math.min(Math.max(Math.round(limit), 1), 500),
  });
}
