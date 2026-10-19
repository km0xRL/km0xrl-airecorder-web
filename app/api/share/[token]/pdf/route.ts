import { NextResponse } from "next/server";
import { hasShareAccess } from "@/lib/auth";
import { contentDispositionInline, NO_STORE } from "@/lib/http";
import { getRecording, getShareByToken, shareStatus } from "@/lib/recordings";
import { pdfFileName, renderRecordingPdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await context.params;
  const share = getShareByToken(token);
  if (!share || shareStatus(share) !== "active") {
    return new NextResponse("Ссылка недействительна", { status: 410 });
  }
  if (!(await hasShareAccess(token, share.id))) {
    return new NextResponse("Нужен пароль", { status: 401 });
  }
  const recording = getRecording(share.recordingId);
  if (!recording) return new NextResponse("Запись не найдена", { status: 404 });

  const pdf = await renderRecordingPdf(recording);
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDispositionInline(pdfFileName(recording)),
      "Content-Length": String(pdf.length),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
