import { NextResponse } from "next/server";
import { jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return jsonResponse({
    ok: true,
    service: "airecorder-web",
    version: "0.1.0",
    time: new Date().toISOString(),
    features: {
      ingest: true,
      audio: true,
      transcript: true,
      report: true,
      pdf: true,
      share: true,
    },
  });
}
