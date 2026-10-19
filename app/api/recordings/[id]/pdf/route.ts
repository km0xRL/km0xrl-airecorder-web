import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { contentDispositionAttachment, contentDispositionInline, NO_STORE } from "@/lib/http";
import { getRecording } from "@/lib/recordings";
import { pdfFileName, renderRecordingPdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const unauthorized = await requireOwnerApi();
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const recording = getRecording(id);
  if (!recording) return new NextResponse("Запись не найдена", { status: 404 });

  const pdf = await renderRecordingPdf(recording);
  const url = new URL(request.url);
  const attachment = url.searchParams.get("download") === "1";
  const fileName = pdfFileName(recording);
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": "application/pdf",
      "Content-Disposition": attachment
        ? contentDispositionAttachment(fileName)
        : contentDispositionInline(fileName),
      "Content-Length": String(pdf.length),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
