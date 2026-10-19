import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { askServiceConfig } from "@/lib/config";
import { getRecording } from "@/lib/recordings";
import type { Recording } from "@/lib/types";

const STOP_WORDS = new Set([
  "что", "как", "где", "когда", "почему", "зачем", "кто", "кого", "кому", "чем", "про", "для", "это",
  "по", "на", "в", "во", "и", "с", "со", "не", "ли", "был", "была", "были", "было", "есть", "какие",
  "какой", "какая", "какое", "каких", "расскажи", "скажи", "можно", "нужно", "надо", "все", "всё",
  "the", "what", "how", "where", "when", "why", "who", "and", "for", "with", "about", "did", "was",
]);

export class AskServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 502,
  ) {
    super(message);
    this.name = "AskServiceError";
  }
}

export interface AskHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface AskSource {
  id: string;
  title: string;
  recordedAtMs: number | null;
}

export interface AskResult {
  text: string;
  sources: AskSource[];
  model: string | null;
  selected: number;
}

interface ServiceAskItem {
  id: string;
  status: string;
  error?: { code?: string; message?: string } | null;
  answer?: { text?: string; citations?: { title?: string }[]; model?: string } | null;
}

interface ContextRecording {
  title: string;
  recorded_at: string | null;
  tags: string[];
  transcript?: string;
  report_markdown?: string;
}

const MAX_CONTEXT_CHARS = 70_000;

function questionTokens(question: string): string[] {
  const raw = question
    .toLocaleLowerCase("ru-RU")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
  return [...new Set(raw)].slice(0, 10);
}

function stems(tokens: string[]): string[] {
  return [...new Set(tokens.map((token) => (token.length > 5 ? token.slice(0, 5) : token)))].slice(0, 8);
}

function excerpt(text: string, tokens: string[], maxChars: number): string {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  const lower = text.toLocaleLowerCase("ru-RU");
  let position = -1;
  for (const token of tokens) {
    const at = lower.indexOf(token);
    if (at >= 0 && (position < 0 || at < position)) position = at;
  }
  if (position < 0) return `${text.slice(0, maxChars).trim()}…`;
  const start = Math.max(0, position - 700);
  const end = Math.min(text.length, start + maxChars);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

function reportText(recording: Recording, tokens: string[]): string {
  const markdown = recording.report?.markdown?.trim();
  if (markdown) return excerpt(markdown, tokens, 4_000);
  const report = recording.report;
  if (!report) return "";
  const parts = [
    report.title ? `# ${report.title}` : "",
    report.summary.length ? `Итоги:\n${report.summary.map((item) => `- ${item}`).join("\n")}` : "",
    report.decisions.length ? `Решения:\n${report.decisions.map((item) => `- ${item}`).join("\n")}` : "",
    report.tasks.length
      ? `Задачи:\n${report.tasks
          .map((task) => `- ${task.title}${task.assignee ? ` — ${task.assignee}` : ""}${task.due ? `, срок ${task.due}` : ""}`)
          .join("\n")}`
      : "",
  ].filter(Boolean);
  return excerpt(parts.join("\n\n"), tokens, 4_000);
}

function transcriptText(recording: Recording, tokens: string[]): string {
  const transcript = recording.transcript;
  if (!transcript) return "";
  const speakers = Object.entries(recording.speakerNames)
    .map(([label, name]) => `${label}: ${name}`)
    .join("; ");
  const text =
    transcript.text ||
    (transcript.segments ?? []).map((segment) => `${segment.speaker ?? ""}: ${segment.text}`).join("\n");
  if (!text) return "";
  return excerpt(speakers ? `Говорящие: ${speakers}\n\n${text}` : text, tokens, 6_000);
}

function candidateRecordings(question: string): Recording[] {
  const tokens = questionTokens(question);
  const queryTokens = stems(tokens);
  const db = getDb();
  const score = queryTokens.length ? queryTokens.map(() => "(instr(r.search_text, ?) > 0)").join(" + ") : "0";
  const rows = db
    .prepare(
      `SELECT r.id FROM recordings r
       WHERE r.deleted_at_ms IS NULL
       ORDER BY (${score}) DESC, COALESCE(r.recorded_at_ms, r.created_at_ms) DESC
       LIMIT 5`,
    )
    .all(...queryTokens) as unknown as { id: string }[];
  return rows.map((row) => getRecording(row.id)).filter((rec): rec is Recording => rec != null);
}

function serviceFetch<T>(
  config: { baseUrl: string; token: string },
  path: string,
  init?: RequestInit,
): Promise<T> {
  return fetch(`${config.baseUrl}${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    headers: {
      Authorization: `Bearer ${config.token}`,
      ...(init?.headers ?? {}),
    },
  }).then(async (response) => {
    const text = await response.text();
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      // Ниже отдадим HTTP-код без тела.
    }
    if (!response.ok) {
      const error = (data as { error?: { code?: string; message?: string } } | null)?.error;
      throw new AskServiceError(
        error?.code ?? `llm_http_${response.status}`,
        error?.message ?? `LLM-сервис ответил ${response.status}`,
        response.status,
      );
    }
    return data as T;
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function askArchive(input: {
  question: string;
  history: AskHistoryItem[];
  recordingId?: string | null;
}): Promise<AskResult> {
  const config = askServiceConfig();
  if (!config) {
    throw new AskServiceError("not_configured", "На сайте не настроен LLM-сервис", 503);
  }

  let selected: Recording[];
  if (input.recordingId) {
    const recording = getRecording(input.recordingId);
    if (!recording) throw new AskServiceError("not_found", "Запись не найдена", 404);
    selected = [recording];
  } else {
    selected = candidateRecordings(input.question);
  }
  if (!selected.length) {
    throw new AskServiceError("empty_library", "В архиве пока нет записей, по которым можно ответить", 400);
  }

  const tokens = questionTokens(input.question);
  const contextRecordings: ContextRecording[] = [];
  for (const recording of selected) {
    const transcript = transcriptText(recording, tokens);
    const report = reportText(recording, tokens);
    if (!transcript && !report) continue;
    contextRecordings.push({
      title: recording.title,
      recorded_at: recording.recordedAtMs ? new Date(recording.recordedAtMs).toISOString() : null,
      tags: recording.tags.slice(0, 20),
      ...(transcript ? { transcript } : {}),
      ...(report ? { report_markdown: report } : {}),
    });
  }
  if (!contextRecordings.length) {
    throw new AskServiceError("empty_context", "У выбранных записей нет текста или отчёта", 400);
  }

  let usedChars = input.question.length + input.history.reduce((sum, item) => sum + item.content.length, 0);
  const compact = contextRecordings.filter((recording) => {
    const size = (recording.transcript?.length ?? 0) + (recording.report_markdown?.length ?? 0);
    if (usedChars + size > MAX_CONTEXT_CHARS) return false;
    usedChars += size;
    return true;
  });
  if (!compact.length) {
    throw new AskServiceError("too_large", "Не удалось уложить контекст в лимит — сузьте вопрос", 413);
  }

  const created = await serviceFetch<ServiceAskItem>(config, "/v1/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: `web-${randomUUID()}`,
      question: input.question,
      history: input.history,
      context: {
        scope: input.recordingId ? "recording" : "library",
        recordings: compact,
      },
    }),
  });

  let item = created;
  const deadline = Date.now() + 55_000;
  while (item.status !== "done" && item.status !== "failed" && Date.now() < deadline) {
    await sleep(1_000);
    item = await serviceFetch<ServiceAskItem>(config, `/v1/ask/${encodeURIComponent(item.id)}`);
  }

  if (item.status === "failed" || item.error) {
    throw new AskServiceError(
      item.error?.code ?? "llm_failed",
      item.error?.message ?? "LLM не смог ответить",
      502,
    );
  }
  if (item.status !== "done" || !item.answer) {
    throw new AskServiceError("timeout", "LLM не ответил за минуту — попробуйте ещё раз", 504);
  }

  const text = String(item.answer.text ?? "").trim();
  if (!text) throw new AskServiceError("empty_answer", "LLM вернул пустой ответ", 502);

  const byTitle = new Map<string, Recording>();
  for (const recording of selected) {
    if (!byTitle.has(recording.title)) byTitle.set(recording.title, recording);
  }
  const sources: AskSource[] = [];
  const seen = new Set<string>();
  for (const citation of item.answer.citations ?? []) {
    const title = String(citation.title ?? "").trim();
    const recording = byTitle.get(title);
    if (!recording || seen.has(recording.id)) continue;
    seen.add(recording.id);
    sources.push({
      id: recording.id,
      title: recording.title,
      recordedAtMs: recording.recordedAtMs,
    });
  }

  return {
    text: text.slice(0, 20_000),
    sources,
    model: item.answer.model ?? null,
    selected: compact.length,
  };
}
