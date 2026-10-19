import { NextResponse } from "next/server";
import { serveAudioFile } from "@/lib/audio-stream";
import { hasShareAccess } from "@/lib/auth";
import { getShareByToken, getStoredAudio, shareStatus } from "@/lib/recordings";
import { resolveAudioPath } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request, context: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await context.params;
  const share = getShareByToken(token);
  if (!share || shareStatus(share) !== "active") {
    return new NextResponse("Ссылка недействительна", { status: 410 });
  }
  if (!(await hasShareAccess(token, share.id))) {
    return new NextResponse("Нужен пароль", { status: 401 });
  }
  const audio = getStoredAudio(share.recordingId);
  if (!audio) return new NextResponse("Аудио не найдено", { status: 404 });
  const filePath = resolveAudioPath(audio.relativePath);
  if (!filePath) return new NextResponse("Аудио не найдено", { status: 404 });
  return serveAudioFile(request, {
    filePath,
    mime: audio.mime,
    fileName: audio.name ?? "recording.m4a",
    attachment: false,
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handle(request, context);
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handle(request, context);
}
