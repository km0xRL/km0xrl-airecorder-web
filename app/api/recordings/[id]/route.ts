import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { apiError, jsonResponse, readTextLimited, sameOrigin } from "@/lib/http";
import { deleteAudioFile } from "@/lib/storage";
import { softDeleteRecording, updateRecordingFields } from "@/lib/recordings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const input = body as { title?: unknown; tags?: unknown };

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

  const recording = updateRecordingFields(id, { title, tags });
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
