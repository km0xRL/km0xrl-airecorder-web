import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { config, paths } from "@/lib/config";
import { randomId } from "@/lib/crypto";
import { safeFileName } from "@/lib/http";

export class UploadError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "UploadError";
    this.status = status;
    this.code = code;
  }
}

const AUDIO_EXTENSIONS = new Set([
  "m4a",
  "mp4",
  "mp3",
  "ogg",
  "opus",
  "wav",
  "webm",
  "amr",
  "3gp",
  "aac",
  "flac",
  "caf",
]);

const EXT_MIME: Record<string, string> = {
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
  webm: "audio/webm",
  amr: "audio/amr",
  "3gp": "audio/3gpp",
  aac: "audio/aac",
  flac: "audio/flac",
  caf: "audio/x-caf",
};

export function mimeForExtension(ext: string): string {
  return EXT_MIME[ext.toLowerCase()] ?? "application/octet-stream";
}

export function extensionFromName(name: string | null | undefined): string | null {
  const ext = name?.match(/\.([A-Za-z0-9]{1,6})$/)?.[1]?.toLowerCase() ?? null;
  return ext && AUDIO_EXTENSIONS.has(ext) ? ext : null;
}

/**
 * Определяет формат по первым байтам. Намеренно без ffmpeg: в контейнере
 * нужен только Node, а форматы телефона и Mac известны заранее.
 */
export function sniffAudioExtension(head: Buffer): string | null {
  if (head.length < 12) return null;
  const ascii = (start: number, end: number) => head.subarray(start, end).toString("latin1");

  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (brand === "M4A " || brand === "M4B " || brand === "mp42" || brand === "isom" || brand === "iso2") {
      return "m4a";
    }
    if (brand === "3gp4" || brand === "3gp5" || brand === "3gp6" || brand === "3g2a") return "3gp";
    return "m4a";
  }
  if (ascii(0, 3) === "ID3") return "mp3";
  if (head[0] === 0xff && (head[1]! & 0xe0) === 0xe0) return "mp3";
  if (ascii(0, 4) === "OggS") return "ogg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "wav";
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "webm";
  if (ascii(0, 5) === "#!AMR") return "amr";
  if (ascii(0, 4) === "fLaC") return "flac";
  if (ascii(0, 4) === "caff") return "caf";
  return null;
}

export interface SavedAudio {
  relativePath: string;
  mime: string;
  size: number;
  sha256: string;
  name: string | null;
  durationS: number | null;
}

function cleanupTempFiles(): void {
  try {
    fs.mkdirSync(paths.tmp, { recursive: true });
    const cutoff = Date.now() - 86_400_000;
    for (const name of fs.readdirSync(paths.tmp)) {
      const candidate = path.join(/* turbopackIgnore: true */ paths.tmp, name);
      try {
        const stat = fs.statSync(candidate);
        if (stat.isFile() && stat.mtimeMs < cutoff) fs.rmSync(candidate, { force: true });
      } catch {
        // Файл уже удалён или занят — не мешает загрузке.
      }
    }
  } catch {
    // Каталог временных файлов недоступен — ошибка проявится при записи.
  }
}

export async function saveAudioUpload(input: {
  recordingId: string;
  body: ReadableStream<Uint8Array> | null;
  contentLength: number | null;
  contentType: string | null;
  fileName: string | null;
  expectedSha256: string | null;
}): Promise<SavedAudio> {
  if (!input.body) throw new UploadError(400, "no_file", "Нет тела файла");
  cleanupTempFiles();
  if (input.contentLength != null && input.contentLength > config.maxAudioBytes) {
    throw new UploadError(
      413,
      "too_large",
      `Файл больше допустимого размера (${Math.round(config.maxAudioBytes / 1024 / 1024)} МБ)`,
    );
  }

  fs.mkdirSync(paths.tmp, { recursive: true });
  fs.mkdirSync(paths.audio, { recursive: true });
  const tempPath = path.join(/* turbopackIgnore: true */ paths.tmp, `${randomId()}.part`);
  const hash = createHash("sha256");
  let bytes = 0;

  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > config.maxAudioBytes) {
        callback(
          new UploadError(
            413,
            "too_large",
            `Файл больше допустимого размера (${Math.round(config.maxAudioBytes / 1024 / 1024)} МБ)`,
          ),
        );
        return;
      }
      hash.update(buffer);
      callback(null, buffer);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(input.body as never),
      meter,
      fs.createWriteStream(tempPath),
    );

    if (bytes === 0) throw new UploadError(400, "empty_file", "Пустой файл");

    const head = Buffer.alloc(64);
    const fd = fs.openSync(tempPath, "r");
    const read = fs.readSync(fd, head, 0, head.length, 0);
    fs.closeSync(fd);

    const sniffed = sniffAudioExtension(head.subarray(0, read));
    const byName = extensionFromName(input.fileName);
    const ext = sniffed ?? byName;
    if (!ext || !AUDIO_EXTENSIONS.has(ext)) {
      throw new UploadError(
        415,
        "unsupported",
        "Не удалось распознать аудиоформат. Поддерживаются m4a, mp3, ogg/opus, wav, webm, amr, 3gp, aac, flac.",
      );
    }

    const sha256 = hash.digest("hex");
    if (input.expectedSha256 && input.expectedSha256.toLowerCase() !== sha256) {
      throw new UploadError(400, "sha_mismatch", "Контрольная сумма не совпала");
    }

    const dir = path.join(/* turbopackIgnore: true */ paths.audio, input.recordingId);
    fs.mkdirSync(dir, { recursive: true });
    const finalPath = path.join(/* turbopackIgnore: true */ dir, `${sha256}.${ext}`);
    fs.renameSync(tempPath, finalPath);

    let durationS: number | null = null;
    try {
      const { parseFile } = await import("music-metadata");
      const parsed = await parseFile(finalPath, { duration: true });
      durationS = parsed.format.duration != null ? Math.round(parsed.format.duration * 100) / 100 : null;
    } catch {
      // Длительность необязательна: браузер всё равно узнает её из файла.
    }

    const declaredMime = input.contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
    const mime =
      declaredMime.startsWith("audio/") || declaredMime.startsWith("video/")
        ? declaredMime
        : mimeForExtension(ext);

    const relativePath = path.relative(config.dataDir, finalPath).split(path.sep).join("/");
    return {
      relativePath,
      mime,
      size: bytes,
      sha256,
      name: input.fileName ? safeFileName(input.fileName) : null,
      durationS,
    };
  } catch (error) {
    fs.rmSync(tempPath, { force: true });
    throw error;
  }
}

export function resolveAudioPath(relativePath: string): string | null {
  const resolved = path.resolve(/* turbopackIgnore: true */ config.dataDir, relativePath);
  const root = path.resolve(config.dataDir) + path.sep;
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

export function deleteAudioFile(relativePath: string | null): void {
  if (!relativePath) return;
  const resolved = resolveAudioPath(relativePath);
  if (!resolved) return;
  fs.rmSync(resolved, { force: true });
  const directory = path.dirname(resolved);
  try {
    if (fs.readdirSync(directory).length === 0) fs.rmdirSync(directory);
  } catch {
    // Не страшно: пустая папка останется.
  }
}

export function audioFileInfo(relativePath: string): { size: number } | null {
  const resolved = resolveAudioPath(relativePath);
  if (!resolved) return null;
  try {
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) return null;
    return { size: stat.size };
  } catch {
    return null;
  }
}
