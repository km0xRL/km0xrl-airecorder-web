#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(file = ".env.local"): void {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();

interface ManifestSegment {
  start: number;
  end: number;
  speaker: string;
  text: string;
}

interface Manifest {
  audio: string;
  total_s: number;
  segments: ManifestSegment[];
}

const looksLikeProduction =
  process.env.NODE_ENV === "production" ||
  process.env.DATA_DIR === "/data" ||
  Boolean(process.env.RAILWAY_ENVIRONMENT);
if (looksLikeProduction && process.env.ALLOW_DEMO_SEED !== "1") {
  console.error(
    "Демо-данные в production запрещены. Для осознанного запуска задайте ALLOW_DEMO_SEED=1.",
  );
  process.exit(1);
}

const dataDir = path.resolve(process.env.DATA_DIR || "./data");
const manifestPath = path.join(dataDir, "demo", "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error("Нет демо-аудио. Сначала выполните: pnpm demo:audio");
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;
const audioPath = path.join(dataDir, "demo", manifest.audio);
if (!fs.existsSync(audioPath)) {
  console.error(`Нет файла ${audioPath}. Выполните: pnpm demo:audio`);
  process.exit(1);
}

const { getDb, closeDbForTests } = await import("../lib/db");
const { parseIngestPayload } = await import("../lib/ingest");
const { upsertIngest, setRecordingAudio, listSharesForRecording, createShare } = await import(
  "../lib/recordings"
);
const { hashPassword } = await import("../lib/crypto");

getDb();

const audioBytes = fs.readFileSync(audioPath);
const sha256 = createHash("sha256").update(audioBytes).digest("hex");
const now = Date.now();
const recordedAt = now - 2 * 3_600_000;
const segments = manifest.segments;

const report = {
  title: "Планёрка по релизу AI Recorder",
  summary: [
    "Релиз AI Recorder назначен на 20 сентября; сервер и веб-кабинет уже готовы.",
    "Аудио хранится на Railway volume, метаданные — в SQLite; на Pro есть ежедневный бэкап.",
    "Получатель ссылки видит плеер, расшифровку с таймкодами, отчёт и PDF — без скачивания аудио.",
    "Ссылки делаются с отдельным паролем и сроком жизни, их можно отозвать или перевыпустить.",
  ],
  decisions: [
    "Релиз — 20 сентября, ссылки с паролем и PDF входят в первый выпуск.",
    "Аудио остаётся на Railway volume; при переполнении переезжаем на S3 без изменения API.",
    "Пароль у каждой ссылки свой, срок жизни — по умолчанию 30 дней.",
  ],
  tasks: [
    { title: "Подготовить чек-лист релиза и прислать в Telegram", assignee: "Анна", due: "18 сентября" },
    { title: "Проверить ссылки и PDF на реальной записи", assignee: "Анна", due: "19 сентября" },
    { title: "Следить за размером аудио на volume", assignee: "Михаил", due: null },
  ],
  tags: ["релиз", "AI Recorder"],
  markdown: [
    "## Договорённости",
    "",
    "- Релиз **20 сентября**.",
    "- Ссылки с паролем и PDF — в первом выпуске.",
    "- Аудио — на Railway volume, метаданные — в SQLite.",
    "",
    "## Что проверить перед выпуском",
    "",
    "1. Загрузка аудио из Android и Mac.",
    "2. Плеер с перемоткой и таймкодами.",
    "3. PDF и пароль ссылки на телефоне.",
  ].join("\n"),
  model: "claude-sonnet",
};

const payload = {
  schema: 1,
  source_name: "demo-meeting.m4a",
  kind: "meeting",
  origin_device: "MacBook Air · демо",
  model: "grok-voice-transcribe-2.0",
  title: "Планёрка по релизу AI Recorder",
  recorded_at_ms: recordedAt,
  duration_s: manifest.total_s,
  tags: ["релиз", "AI Recorder", "команда"],
  speaker_names: { "Спикер 1": "Михаил", "Спикер 2": "Анна" },
  transcript: {
    id: "demo-transcript",
    text: segments.map((segment) => segment.text).join(" "),
    duration_s: manifest.total_s,
    model: "grok-voice-transcribe-2.0",
    language: "ru",
    segments: segments.map((segment) => ({
      start: segment.start,
      end: segment.end,
      speaker: segment.speaker,
      text: segment.text,
    })),
  },
  report,
  marks: [
    { start: segments[2]?.start ?? 0, end: segments[2]?.end ?? 1 },
    { start: segments[12]?.start ?? 0, end: segments[12]?.end ?? 1 },
  ],
  hints: [
    {
      key: "demo-release-date",
      kind: "decision",
      start: segments[1]?.start ?? 0,
      end: segments[1]?.end ?? 1,
      text: "Зафиксировано 20 сентября — стоит проверить, что команда успевает.",
      quote: segments[1]?.text ?? "",
      mark: false,
    },
    {
      key: "demo-storage",
      kind: "question",
      start: segments[5]?.start ?? 0,
      end: segments[5]?.end ?? 1,
      text: "Что делать, если том закончится? Ответ про S3 стоит закрепить в отчёте.",
      quote: segments[7]?.text ?? "",
      mark: false,
    },
  ],
  updated_at_ms: now,
};

const normalized = parseIngestPayload("demo-release-001", payload);
const result = upsertIngest("demo-release-001", normalized);
const recording = result.recording;

setRecordingAudio(recording.id, {
  relativePath: path.relative(dataDir, audioPath).split(path.sep).join("/"),
  mime: "audio/mp4",
  size: audioBytes.length,
  sha256,
  name: "demo-meeting.m4a",
  durationS: manifest.total_s,
});

let shareUrl: string | null = null;
let sharePassword: string | null = null;
const existingShares = listSharesForRecording(recording.id).filter((share) => !share.revokedAtMs);
if (existingShares.length === 0) {
  sharePassword = "demo2026";
  const share = createShare({
    recordingId: recording.id,
    passwordHash: await hashPassword(sharePassword),
    label: "Демо",
    expiresAtMs: now + 90 * 86_400_000,
  });
  const base = (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
  shareUrl = `${base}/s/${share.token}`;
}

const base = (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
console.log(`Запись: ${recording.title} (${recording.id})`);
console.log(`Аудио:  ${path.relative(process.cwd(), audioPath)} · ${Math.round(audioBytes.length / 1024)} КБ`);
console.log(`Кабинет: ${base}/recordings/${recording.id}`);
if (shareUrl && sharePassword) {
  console.log(`Ссылка:  ${shareUrl}`);
  console.log(`Пароль:  ${sharePassword}`);
} else {
  console.log("У записи уже есть активная ссылка — новый пароль не создавался.");
}
closeDbForTests();
