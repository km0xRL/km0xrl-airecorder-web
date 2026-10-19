import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { serveAudioFile } from "@/lib/audio-stream";
import { getStoredAudio } from "@/lib/recordings";
import { resolveAudioPath } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const unauthorized = await requireOwnerApi();
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const audio = getStoredAudio(id);
  if (!audio) return new NextResponse("Аудио не найдено", { status: 404 });
  const filePath = resolveAudioPath(audio.relativePath);
  if (!filePath) return new NextResponse("Аудио не найдено", { status: 404 });
  const url = new URL(request.url);
  return serveAudioFile(request, {
    filePath,
    mime: audio.mime,
    fileName: audio.name ?? `${id}.m4a`,
    attachment: url.searchParams.get("download") === "1",
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(request, context);
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(request, context);
}
