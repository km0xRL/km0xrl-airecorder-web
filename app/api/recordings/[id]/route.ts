import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { apiError, jsonResponse, readTextLimited, sameOrigin } from "@/lib/http";
import { deleteAudioFile } from "@/lib/storage";
import { softDeleteRecording, updateRecordingFields } from "@/lib/recordings";
import type { Mark } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readStringMap(value: unknown, numericKeys: boolean, maxEntries: number): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > maxEntries) return null;
  const result: Record<string, string> = {};
  for (const [rawKey, rawValue] of entries) {
    if (typeof rawValue !== "string") return null;
    const key = rawKey.trim();
    const text = rawValue.trim().slice(0, 200);
    if (!key || key.length > 100 || !text) continue;
    if (numericKeys && !/^\d{1,6}$/.test(key)) return null;
    result[key] = text;
  }
  return result;
}

function readMarks(value: unknown): Mark[] | null {
  if (!Array.isArray(value) || value.length > 500) return null;
  const marks: Mark[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return null;
    const start = Number((raw as { start?: unknown }).start);
    const end = Number((raw as { end?: unknown }).end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) return null;
    marks.push({
      start: Math.round(start * 1000) / 1000,
      end: Math.round(end * 1000) / 1000,
    });
  }
  return marks.sort((a, b) => a.start - b.start || a.end - b.end);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireOwnerApi();
  if (unauthorized) return unauthorized;
  if (!sameOrigin(request)) return apiError(403, "bad_origin", "Чужой источник запроса");

  const { id } = await context.params;
  let body: unknown;
  try {
    body = JSON.parse(await readTextLimited(request, 64 * 1024));
  } catch {
    return apiError(400, "bad_json", "Неверный JSON");
  }
  if (!body || typeof body !== "object") return apiError(400, "bad_json", "Неверный JSON");
  const input = body as {
    title?: unknown;
    tags?: unknown;
    speaker_names?: unknown;
    speaker_overrides?: unknown;
    marks?: unknown;
  };

  let title: string | undefined;
  if (input.title !== undefined) {
    if (typeof input.title !== "string") return apiError(400, "bad_title", "Название должно быть строкой");
    title = input.title.trim();
    if (!title) return apiError(400, "bad_title", "Название не может быть пустым");
    if (title.length > 300) return apiError(400, "bad_title", "Название длиннее 300 символов");
  }

  let tags: string[] | undefined;
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags) || input.tags.some((tag) => typeof tag !== "string")) {
      return apiError(400, "bad_tags", "Теги должны быть массивом строк");
    }
    const seen = new Set<string>();
    tags = [];
    for (const raw of input.tags as string[]) {
      const tag = raw.trim().replace(/^#/, "").replace(/\s+/g, " ").slice(0, 80);
      if (!tag) continue;
      const key = tag.toLocaleLowerCase("ru-RU");
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
      if (tags.length >= 50) break;
    }
  }

  let speakerNames: Record<string, string> | undefined;
  if (input.speaker_names !== undefined) {
    const parsed = readStringMap(input.speaker_names, false, 200);
    if (!parsed) return apiError(400, "bad_speaker_names", "Имена говорящих должны быть объектом строк");
    speakerNames = parsed;
  }

  let speakerOverrides: Record<string, string> | undefined;
  if (input.speaker_overrides !== undefined) {
    const parsed = readStringMap(input.speaker_overrides, true, 5000);
    if (!parsed) return apiError(400, "bad_speaker_overrides", "Поправки говорящих должны быть объектом строк");
    speakerOverrides = parsed;
  }

  let marks: Mark[] | undefined;
  if (input.marks !== undefined) {
    const parsed = readMarks(input.marks);
    if (!parsed) return apiError(400, "bad_marks", "Метки должны быть списком отрезков start/end");
    marks = parsed;
  }

  const recording = updateRecordingFields(id, { title, tags, speakerNames, speakerOverrides, marks });
  if (!recording) return apiError(404, "not_found", "Запись не найдена");
  return jsonResponse({ recording });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireOwnerApi();
  if (unauthorized) return unauthorized;
  if (!sameOrigin(request)) return apiError(403, "bad_origin", "Чужой источник запроса");

  const { id } = await context.params;
  const result = softDeleteRecording(id);
  if (!result.found) return apiError(404, "not_found", "Запись не найдена");
  deleteAudioFile(result.audioPath);
  return jsonResponse({ ok: true });
}
