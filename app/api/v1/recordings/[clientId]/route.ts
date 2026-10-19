import { NextResponse } from "next/server";
import { checkIngestAuth } from "@/lib/auth";
import { absoluteUrl, apiError, jsonResponse, PayloadTooLargeError, readTextLimited } from "@/lib/http";
import { IngestValidationError, isValidClientId, parseIngestPayload } from "@/lib/ingest";
import {
  getRecordingRowByClientId,
  rowToRecording,
  softDeleteRecording,
  upsertIngest,
} from "@/lib/recordings";
import { deleteAudioFile } from "@/lib/storage";
import type { Recording } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function libraryJson(recording: Recording) {
  return {
    schema: 1,
    id: recording.clientId,
    source_name: recording.sourceName ?? recording.title,
    kind: recording.kind,
    recorded_at_ms: recording.recordedAtMs,
    duration_s: recording.durationS,
    origin_device: recording.originDevice,
    model: recording.model,
    title: recording.title,
    tags: recording.tags,
    speaker_names: recording.speakerNames,
    speaker_overrides: recording.speakerOverrides,
    transcript: recording.transcript,
    report: recording.report,
    marks: recording.marks,
    hints: recording.hints,
    updated_at_ms: recording.updatedAtMs,
    deleted: recording.deletedAtMs != null,
    audio: recording.audio
      ? {
          uploaded: true,
          size: recording.audio.size,
          mime: recording.audio.mime,
          sha256: recording.audio.sha256,
        }
      : { uploaded: false },
  };
}

function failure(error: unknown): NextResponse {
  if (error instanceof IngestValidationError) return apiError(400, error.code, error.message);
  if (error instanceof PayloadTooLargeError) return apiError(413, "too_large", "Слишком большой JSON");
  if (error instanceof Error && error.message === "recording_not_found") {
    return apiError(404, "not_found", "Запись ещё не создана");
  }
  console.error("[ingest]", error);
  return apiError(500, "internal", "Внутренняя ошибка сервера");
}

export async function GET(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
): Promise<NextResponse> {
  const unauthorized = checkIngestAuth(request);
  if (unauthorized) return unauthorized;
  const { clientId } = await context.params;
  if (!isValidClientId(clientId)) return apiError(400, "bad_client_id", "Неверный client_id");
  const row = getRecordingRowByClientId(clientId);
  if (!row) return apiError(404, "not_found", "Запись не найдена");
  return jsonResponse(libraryJson(rowToRecording(row)));
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
): Promise<NextResponse> {
  const unauthorized = checkIngestAuth(request);
  if (unauthorized) return unauthorized;
  const { clientId } = await context.params;
  if (!isValidClientId(clientId)) return apiError(400, "bad_client_id", "Неверный client_id");

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return apiError(415, "bad_content_type", "Нужен Content-Type: application/json");
  }

  try {
    const text = await readTextLimited(request, 6 * 1024 * 1024);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return apiError(400, "bad_json", "Неверный JSON");
    }
    const normalized = parseIngestPayload(clientId, body);

    if (normalized.deleted) {
      const row = getRecordingRowByClientId(clientId);
      if (!row) return apiError(404, "not_found", "Запись ещё не создана");
      const result = softDeleteRecording(row.id);
      deleteAudioFile(result.audioPath);
      return jsonResponse({
        ok: true,
        id: clientId,
        deleted: true,
        updated_at_ms: Date.now(),
      });
    }

    const result = upsertIngest(clientId, normalized);
    return jsonResponse(
      {
        ok: true,
        id: clientId,
        created: result.created,
        skipped: result.skipped,
        updated_at_ms: result.recording.updatedAtMs,
        title: result.recording.title,
        audio_upload_url: absoluteUrl(
          request,
          `/api/v1/recordings/${encodeURIComponent(clientId)}/audio`,
        ),
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
): Promise<NextResponse> {
  const unauthorized = checkIngestAuth(request);
  if (unauthorized) return unauthorized;
  const { clientId } = await context.params;
  if (!isValidClientId(clientId)) return apiError(400, "bad_client_id", "Неверный client_id");
  const row = getRecordingRowByClientId(clientId);
  if (!row) return apiError(404, "not_found", "Запись не найдена");
  const result = softDeleteRecording(row.id);
  deleteAudioFile(result.audioPath);
  return jsonResponse({ ok: true, id: clientId, deleted: true });
}
