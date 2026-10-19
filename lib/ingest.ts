import { z } from "zod";
import type {
  Hint,
  Mark,
  MeetingReport,
  RecordingKind,
  ReportTask,
  Transcript,
  TranscriptSegment,
} from "@/lib/types";

const numberish = z
  .union([z.number(), z.string()])
  .transform((value) => (typeof value === "number" ? value : Number(String(value).replace(",", "."))))
  .refine((value) => Number.isFinite(value), "Ожидается число");

const nullableText = (max: number) => z.string().max(max).nullable().optional();

const segmentSchema = z.object({
  start: numberish,
  end: numberish.optional(),
  speaker: nullableText(120),
  text: z.string().max(50_000),
});

const chunkSchema = z.object({
  seq: numberish,
  page: numberish.nullable().optional(),
  text: z.string().max(50_000),
});

const transcriptSchema = z.object({
  id: nullableText(200),
  text: z.string().max(2_000_000).optional(),
  duration_s: numberish.nullable().optional(),
  model: nullableText(200),
  language: nullableText(40),
  segments: z.array(segmentSchema).max(100_000).optional(),
  chunks: z.array(chunkSchema).max(100_000).optional(),
  warnings: z.array(z.unknown()).max(1000).optional(),
});

const reportTaskSchema = z.object({
  title: z.string().max(2000),
  assignee: nullableText(500),
  due: nullableText(200),
});

const reportSchema = z.object({
  title: nullableText(300),
  summary: z.array(z.string().max(20_000)).max(200).optional(),
  decisions: z.array(z.string().max(20_000)).max(200).optional(),
  tasks: z.array(reportTaskSchema).max(500).optional(),
  tags: z.array(z.string().max(200)).max(100).optional(),
  markdown: nullableText(300_000),
  model: nullableText(200),
});

const markSchema = z.object({
  start: numberish,
  end: numberish,
});

const hintSchema = z
  .object({
    key: z.string().max(500).optional(),
    kind: z.string().max(50).optional(),
    start: numberish.optional(),
    end: numberish.optional(),
    text: z.string().max(10_000),
    quote: z.string().max(10_000).optional(),
    mark: z.boolean().optional(),
  })
  .passthrough();

const payloadSchema = z.object({
  schema: z.number().optional(),
  source: z.enum(["meeting", "call"]).optional(),
  kind: z.enum(["meeting", "online_call", "phone_call"]).optional(),
  source_name: z.string().max(500).optional(),
  origin_device: nullableText(200),
  model: nullableText(200),
  title: nullableText(300),
  recorded_at_ms: numberish.nullable().optional(),
  recorded_at: z.string().max(100).optional(),
  duration_s: numberish.nullable().optional(),
  tags: z.array(z.string().max(200)).max(100).optional(),
  tags_edited: z.boolean().optional(),
  tag_titles: z.record(z.string(), z.string().max(200)).optional(),
  voice_named: z.array(z.string().max(200)).max(500).optional(),
  speaker_names: z.record(z.string().max(200), z.string().max(200)).optional(),
  speaker_overrides: z.record(z.string().max(50), z.string().max(200)).optional(),
  transcript: transcriptSchema.nullable().optional(),
  report: reportSchema.nullable().optional(),
  marks: z.array(markSchema).max(10_000).optional(),
  hints: z.array(hintSchema).max(5000).optional(),
  updated_at_ms: numberish.nullable().optional(),
  deleted: z.boolean().optional(),
});

export class IngestValidationError extends Error {
  readonly code: string;

  constructor(message: string, code = "bad_request") {
    super(message);
    this.name = "IngestValidationError";
    this.code = code;
  }
}

export interface NormalizedIngest {
  clientId: string;
  title: string;
  kind: RecordingKind;
  sourceName: string | null;
  originDevice: string | null;
  model: string | null;
  recordedAtMs: number | null;
  durationS: number | null;
  tags: string[];
  tagsEdited: boolean;
  voiceNamed: string[];
  speakerNames: Record<string, string>;
  speakerOverrides: Record<string, string>;
  transcript: Transcript | null;
  report: MeetingReport | null;
  marks: Mark[];
  hints: Hint[];
  updatedAtMs: number;
  deleted: boolean;
  searchText: string;
}

export const CLIENT_ID_RE = /^[A-Za-z0-9._:-]{1,100}$/;

export function isValidClientId(clientId: string): boolean {
  return CLIENT_ID_RE.test(clientId);
}

function uniqueStrings(values: string[], limit = 50): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim().replace(/\s+/g, " ");
    if (!value) continue;
    const key = value.toLocaleLowerCase("ru-RU");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function normalizeSegments(raw: z.infer<typeof segmentSchema>[] | undefined): TranscriptSegment[] {
  if (!raw?.length) return [];
  return raw
    .map((segment) => {
      const start = Math.max(0, segment.start);
      const end = Math.max(start, segment.end ?? start);
      return {
        start,
        end,
        speaker: segment.speaker?.trim() || null,
        text: segment.text.trim(),
      };
    })
    .filter((segment) => segment.text.length > 0);
}

function normalizeTranscript(raw: z.infer<typeof transcriptSchema> | null | undefined): Transcript | null {
  if (!raw) return null;
  const segments = normalizeSegments(raw.segments);
  const text = (raw.text ?? "").trim() || segments.map((segment) => segment.text).join(" ");
  if (!text && !segments.length) return null;
  return {
    id: raw.id ?? null,
    text,
    duration_s: raw.duration_s ?? null,
    model: raw.model ?? null,
    language: raw.language ?? null,
    segments,
    chunks: (raw.chunks ?? []).map((chunk) => ({
      seq: chunk.seq,
      page: chunk.page ?? null,
      text: chunk.text,
    })),
    warnings: raw.warnings ?? [],
  };
}

function normalizeTasks(raw: z.infer<typeof reportTaskSchema>[] | undefined): ReportTask[] {
  return (raw ?? [])
    .map((task) => ({
      title: task.title.trim(),
      assignee: task.assignee?.trim() || null,
      due: task.due?.trim() || null,
    }))
    .filter((task) => task.title.length > 0)
    .slice(0, 200);
}

function normalizeReport(raw: z.infer<typeof reportSchema> | null | undefined): MeetingReport | null {
  if (!raw) return null;
  const summary = (raw.summary ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 100);
  const decisions = (raw.decisions ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 100);
  const tasks = normalizeTasks(raw.tasks);
  const markdown = raw.markdown?.trim() || null;
  if (!summary.length && !decisions.length && !tasks.length && !markdown && !raw.title) return null;
  return {
    title: raw.title?.trim() || null,
    summary,
    decisions,
    tasks,
    tags: raw.tags ?? [],
    markdown,
    model: raw.model ?? null,
  };
}

function normalizeMarks(raw: z.infer<typeof markSchema>[] | undefined): Mark[] {
  return (raw ?? [])
    .map((mark) => ({
      start: Math.max(0, mark.start),
      end: Math.max(Math.max(0, mark.start), mark.end),
    }))
    .sort((a, b) => a.start - b.start)
    .slice(0, 5000);
}

function normalizeHints(raw: z.infer<typeof hintSchema>[] | undefined): Hint[] {
  return (raw ?? [])
    .map((hint) => ({
      key: hint.key,
      kind: hint.kind,
      start: hint.start ?? undefined,
      end: hint.end ?? undefined,
      text: hint.text.trim(),
      quote: hint.quote?.trim() || undefined,
      mark: hint.mark ?? false,
    }))
    .filter((hint) => hint.text.length > 0)
    .slice(0, 2000);
}

function stripExtension(value: string): string {
  return value.replace(/\.[A-Za-z0-9]{1,6}$/, "").trim();
}

function buildSearchText(input: {
  title: string;
  tags: string[];
  transcript: Transcript | null;
  report: MeetingReport | null;
}): string {
  const parts = [
    input.title,
    input.tags.join(" "),
    input.transcript?.text ?? "",
    input.report?.summary.join(" ") ?? "",
    input.report?.decisions.join(" ") ?? "",
    input.report?.tasks.map((task) => `${task.title} ${task.assignee ?? ""}`).join(" ") ?? "",
    input.report?.markdown ?? "",
  ];
  return parts.join("\n").toLocaleLowerCase("ru-RU").replace(/\s+/g, " ").trim();
}

export function parseIngestPayload(clientId: string, body: unknown, now = Date.now()): NormalizedIngest {
  if (!isValidClientId(clientId)) {
    throw new IngestValidationError(
      "client_id: латиница, цифры и символы . _ : - до 100 знаков",
      "bad_client_id",
    );
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path?.length ? `${first.path.join(".")}: ` : "";
    throw new IngestValidationError(`${where}${first?.message ?? "Неверный JSON"}`, "bad_request");
  }
  const raw = parsed.data;

  const transcript = normalizeTranscript(raw.transcript);
  const report = normalizeReport(raw.report);

  const tagTitles = raw.tag_titles ?? {};
  const rawTags = [...(raw.tags ?? []), ...(report?.tags ?? [])];
  const tags = uniqueStrings(
    rawTags.map((tag) => tagTitles[tag] ?? tag),
    50,
  );

  const kind: RecordingKind = raw.kind ?? (raw.source === "call" ? "phone_call" : "meeting");
  const sourceName = raw.source_name?.trim() || null;
  const title =
    raw.title?.trim() ||
    report?.title?.trim() ||
    (sourceName ? stripExtension(sourceName) : "") ||
    "Запись";

  const updatedAtMs = Math.round(raw.updated_at_ms ?? now);
  const parsedRecordedAt = raw.recorded_at ? Date.parse(raw.recorded_at) : Number.NaN;
  const recordedAtMs =
    raw.recorded_at_ms != null
      ? Math.round(raw.recorded_at_ms)
      : Number.isFinite(parsedRecordedAt)
        ? Math.round(parsedRecordedAt)
        : null;

  return {
    clientId,
    title: title.slice(0, 300),
    kind,
    sourceName,
    originDevice: raw.origin_device?.trim() || null,
    model: raw.model?.trim() || transcript?.model || null,
    recordedAtMs,
    durationS: raw.duration_s ?? transcript?.duration_s ?? null,
    tags,
    tagsEdited: raw.tags_edited ?? false,
    voiceNamed: raw.voice_named ? [...new Set(raw.voice_named.map((value) => value.trim()).filter(Boolean))] : [],
    speakerNames: raw.speaker_names ?? {},
    speakerOverrides: raw.speaker_overrides ?? {},
    transcript,
    report,
    marks: normalizeMarks(raw.marks),
    hints: normalizeHints(raw.hints),
    updatedAtMs,
    deleted: raw.deleted ?? false,
    searchText: buildSearchText({ title, tags, transcript, report }),
  };
}

export function rebuildSearchText(input: {
  title: string;
  tags: string[];
  transcript: Transcript | null;
  report: MeetingReport | null;
}): string {
  return buildSearchText(input);
}
