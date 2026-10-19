import { NextResponse } from "next/server";
import { jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Совместимый с приложением health: по нему Android/Mac понимают, что библиотека поддерживается. */
export async function GET(): Promise<NextResponse> {
  return jsonResponse({
    ok: true,
    service: "airecorder-web",
    version: "0.1.0",
    temporary: false,
    library: true,
    reports: false,
    ask: false,
    live: false,
    models: [],
    time: new Date().toISOString(),
  });
}
