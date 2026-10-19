import { NextResponse } from "next/server";
import { checkIngestAuth } from "@/lib/auth";
import { apiError, jsonResponse, PayloadTooLargeError, readTextLimited } from "@/lib/http";
import { IngestValidationError, isValidClientId } from "@/lib/ingest";
import {
  entryWithoutData,
  getLibraryEntryByClientId,
  putLibraryRecord,
  type LibraryData,
} from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = checkIngestAuth(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  if (!isValidClientId(id)) return apiError(400, "bad_id", "Неверный id записи");

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return apiError(415, "bad_content_type", "Нужен Content-Type: application/json");
  }

  try {
    const text = await readTextLimited(request, 5 * 1024 * 1024);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return apiError(400, "bad_json", "Неверный JSON");
    }
    if (!body || typeof body !== "object") return apiError(400, "bad_json", "Неверный JSON");
    const input = body as {
      updated_at_ms?: unknown;
      deleted?: unknown;
      data?: unknown;
    };
    const updatedAtMs = Number(input.updated_at_ms);
    if (!Number.isFinite(updatedAtMs) || updatedAtMs < 0) {
      return apiError(400, "bad_updated_at", "updated_at_ms — миллисекунды эпохи");
    }
    const deleted = input.deleted === true;
    if (!deleted && (!input.data || typeof input.data !== "object")) {
      return apiError(400, "no_data", "Для неудалённой записи нужен data");
    }

    const outcome = putLibraryRecord(id, {
      updatedAtMs: Math.round(updatedAtMs),
      deleted,
      data: deleted ? null : (input.data as LibraryData),
    });
    if (outcome.stale) {
      return NextResponse.json(
        {
          error: {
            code: "stale",
            message: "На сайте версия новее",
            retryable: false,
          },
          item: outcome.entry,
        },
        { status: 409 },
      );
    }
    return jsonResponse(entryWithoutData(outcome.entry));
  } catch (error) {
    if (error instanceof IngestValidationError) return apiError(400, error.code, error.message);
    if (error instanceof PayloadTooLargeError) return apiError(413, "too_large", "Слишком большая запись");
    if (error instanceof Error && error.message === "no_data") {
      return apiError(400, "no_data", "Для неудалённой записи нужен data");
    }
    console.error("[library-put]", error);
    return apiError(500, "internal", "Не удалось сохранить запись");
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = checkIngestAuth(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  if (!isValidClientId(id)) return apiError(400, "bad_id", "Неверный id записи");
  const entry = getLibraryEntryByClientId(id);
  if (!entry) return apiError(404, "not_found", "Запись не найдена");
  return jsonResponse(entry);
}
