import fs from "node:fs";
import { Readable } from "node:stream";
import { parseRange } from "@/lib/audio-range";
import { contentDispositionAttachment, contentDispositionInline } from "@/lib/http";

export interface AudioStreamOptions {
  filePath: string;
  mime: string;
  fileName: string;
  attachment?: boolean;
}

/**
 * Отдаёт аудио с поддержкой Range — без этого браузер не даёт перематывать
 * и начинает качать файл целиком. Заголовок Content-Disposition — inline:
 * файл играется, а не предлагается к сохранению.
 */
export function serveAudioFile(request: Request, options: AudioStreamOptions): Response {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(options.filePath);
    if (!stat.isFile()) throw new Error("not a file");
  } catch {
    return new Response("Аудио не найдено", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const size = stat.size;
  const range = parseRange(request.headers.get("range"), size);
  const common = new Headers({
    "Content-Type": options.mime || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Content-Disposition": options.attachment
      ? contentDispositionAttachment(options.fileName)
      : contentDispositionInline(options.fileName),
    "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Last-Modified": stat.mtime.toUTCString(),
  });

  if (range === "invalid") {
    common.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers: common });
  }

  if (range) {
    common.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
    common.set("Content-Length", String(range.end - range.start + 1));
    if (request.method === "HEAD") return new Response(null, { status: 206, headers: common });
    const stream = fs.createReadStream(options.filePath, { start: range.start, end: range.end });
    return new Response(Readable.toWeb(stream) as ReadableStream, { status: 206, headers: common });
  }

  common.set("Content-Length", String(size));
  if (request.method === "HEAD") return new Response(null, { status: 200, headers: common });
  const stream = fs.createReadStream(options.filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, { status: 200, headers: common });
}
