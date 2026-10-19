import { NextResponse } from "next/server";
import { checkIngestAuth } from "@/lib/auth";
import { apiError, jsonResponse } from "@/lib/http";
import { isValidClientId } from "@/lib/ingest";
import {
  clearRecordingAudio,
  getRecordingRowByClientId,
  setRecordingAudio,
} from "@/lib/recordings";
import { deleteAudioFile, saveAudioUpload, UploadError } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
): Promise<NextResponse> {
  const unauthorized = checkIngestAuth(request);
  if (unauthorized) return unauthorized;
  const { clientId } = await context.params;
  if (!isValidClientId(clientId)) return apiError(400, "bad_client_id", "Неверный client_id");

  const row = getRecordingRowByClientId(clientId);
  if (!row) {
    return apiError(404, "not_found", "Сначала отправьте метаданные записи: PUT /api/v1/recordings/{id}");
  }
  if (row.deleted_at_ms != null) return apiError(409, "deleted", "Запись удалена");

  const url = new URL(request.url);
  const queryName = url.searchParams.get("name");
  const fileName = queryName ? decodeURIComponent(queryName) : request.headers.get("x-file-name");
  const contentLengthRaw = request.headers.get("content-length");
  const contentLength = contentLengthRaw != null ? Number(contentLengthRaw) : null;

  try {
    const saved = await saveAudioUpload({
      recordingId: row.id,
      body: request.body,
      contentLength: Number.isFinite(contentLength as number) ? contentLength : null,
      contentType: request.headers.get("content-type"),
      fileName,
      expectedSha256: request.headers.get("x-sha256"),
    });
    const { previousPath } = setRecordingAudio(row.id, saved);
    if (previousPath && previousPath !== saved.relativePath) deleteAudioFile(previousPath);
    return jsonResponse({
      ok: true,
      id: clientId,
      audio: {
        size: saved.size,
        mime: saved.mime,
        sha256: saved.sha256,
        duration_s: saved.durationS,
      },
    });
  } catch (error) {
    if (error instanceof UploadError) return apiError(error.status, error.code, error.message);
    console.error("[audio-upload]", error);
    return apiError(500, "internal", "Не удалось сохранить аудио");
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
  const previous = clearRecordingAudio(row.id);
  deleteAudioFile(previous);
  return jsonResponse({ ok: true, id: clientId, audio: null });
}
