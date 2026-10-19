import { getDb, inTransaction, nextSeq, type RecordingRow } from "@/lib/db";
import { parseIngestPayload } from "@/lib/ingest";
import {
  getRecordingRowByClientId,
  rowToRecording,
  softDeleteRecording,
  upsertIngest,
} from "@/lib/recordings";
import type { Recording } from "@/lib/types";

/** Документ LibraryData приложения (Б14), который сайт принимает и отдаёт без потерь. */
export interface LibraryData {
  schema?: number;
  source_name: string;
  kind?: string;
  recorded_at_ms?: number | null;
  duration_s?: number | null;
  origin_device?: string | null;
  model?: string | null;
  title?: string | null;
  tags?: string[];
  tags_edited?: boolean;
  tag_titles?: Record<string, string>;
  voice_named?: string[];
  speaker_names?: Record<string, string>;
  speaker_overrides?: Record<string, string>;
  transcript?: unknown;
  report?: unknown;
  marks?: unknown[];
  hints?: unknown[];
}

export interface LibraryEntryView {
  id: string;
  seq: number;
  updated_at_ms: number;
  deleted: boolean;
  data: LibraryData | null;
  audio_uploaded: boolean;
  audio_sha256: string | null;
  audio_size: number | null;
}

export function libraryDataFromRecording(recording: Recording): LibraryData {
  return {
    schema: 1,
    source_name: recording.sourceName ?? recording.title,
    kind: recording.kind,
    recorded_at_ms: recording.recordedAtMs,
    duration_s: recording.durationS,
    origin_device: recording.originDevice,
    model: recording.model,
    title: recording.title,
    tags: recording.tags,
    tags_edited: recording.tagsEdited,
    // Сайт хранит названия тегов. Карта сохраняет совместимость с приложением,
    // которое умеет показывать названия рядом с id каталога.
    tag_titles: Object.fromEntries(recording.tags.map((tag) => [tag, tag])),
    voice_named: recording.voiceNamed,
    speaker_names: recording.speakerNames,
    speaker_overrides: recording.speakerOverrides,
    transcript: recording.transcript,
    report: recording.report,
    marks: recording.marks,
    hints: recording.hints,
  };
}

export function libraryEntryFromRow(row: RecordingRow): LibraryEntryView {
  const deleted = row.deleted_at_ms != null;
  return {
    id: row.client_id,
    seq: Number(row.seq ?? 0),
    updated_at_ms: row.updated_at_ms,
    deleted,
    data: deleted ? null : libraryDataFromRecording(rowToRecording(row)),
    audio_uploaded: Boolean(row.audio_path),
    audio_sha256: row.audio_sha256,
    audio_size: row.audio_size,
  };
}

export function entryWithoutData(entry: LibraryEntryView): Omit<LibraryEntryView, "data"> {
  const { data: _data, ...rest } = entry;
  return rest;
}

export function getLibraryEntryByClientId(clientId: string): LibraryEntryView | null {
  const row = getRecordingRowByClientId(clientId);
  return row ? libraryEntryFromRow(row) : null;
}

export function getLibraryChanges(since: number, limit: number): {
  items: LibraryEntryView[];
  next: number;
  more: boolean;
} {
  const safeLimit = Math.min(Math.max(Math.round(limit), 1), 200);
  const rows = getDb()
    .prepare("SELECT * FROM recordings WHERE seq > ? ORDER BY seq ASC LIMIT ?")
    .all(Math.max(0, Math.round(since)), safeLimit) as unknown as RecordingRow[];
  const items = rows.map(libraryEntryFromRow);
  const next = items.length ? items[items.length - 1]!.seq : Math.max(0, Math.round(since));
  return { items, next, more: items.length >= safeLimit };
}

export interface LibraryPutInput {
  updatedAtMs: number;
  deleted: boolean;
  data: LibraryData | null;
}

export interface LibraryPutOutcome {
  stale: boolean;
  entry: LibraryEntryView;
}

/**
 * Версия записи из приложения. Побеждает последняя по updated_at_ms.
 * Удаление без существующей записи оставляет надгробие — чтобы его увидели другие устройства.
 */
export function putLibraryRecord(clientId: string, input: LibraryPutInput): LibraryPutOutcome {
  const db = getDb();
  const existing = getRecordingRowByClientId(clientId);

  if (existing && input.updatedAtMs < existing.updated_at_ms) {
    return { stale: true, entry: libraryEntryFromRow(existing) };
  }

  const now = Date.now();
  if (input.deleted) {
    if (existing) {
      if (existing.deleted_at_ms != null) {
        const at = Math.max(now, input.updatedAtMs);
        inTransaction(db, () => {
          db.prepare(
            "UPDATE recordings SET deleted_at_ms = ?, updated_at_ms = ?, seq = ? WHERE id = ?",
          ).run(at, at, nextSeq(db), existing.id);
        });
      } else {
        softDeleteRecording(existing.id, input.updatedAtMs);
      }
    } else {
      const at = Math.max(now, input.updatedAtMs);
      inTransaction(db, () => {
        db.prepare(
          `INSERT INTO recordings (
            id, client_id, title, kind, source_name, origin_device, model,
            recorded_at_ms, duration_s, tags_json, tags_edited, voice_named_json,
            speaker_names_json, speaker_overrides_json, transcript_json, report_json,
            marks_json, hints_json, search_text, created_at_ms, updated_at_ms,
            deleted_at_ms, seq
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          crypto.randomUUID(),
          clientId,
          "Удалено",
          "meeting",
          null,
          null,
          null,
          null,
          null,
          "[]",
          0,
          "[]",
          "{}",
          "{}",
          null,
          null,
          "[]",
          "[]",
          "удалено",
          now,
          at,
          at,
          nextSeq(db),
        );
      });
    }
    const row = getRecordingRowByClientId(clientId);
    return { stale: false, entry: libraryEntryFromRow(row!) };
  }

  if (!input.data || typeof input.data !== "object") {
    throw new Error("no_data");
  }
  const payload = {
    ...input.data,
    updated_at_ms: input.updatedAtMs,
    deleted: false,
  };
  const normalized = parseIngestPayload(clientId, payload, now);
  const result = upsertIngest(clientId, normalized);
  const row = getRecordingRowByClientId(clientId);
  return { stale: false, entry: libraryEntryFromRow(row ?? result.recording as unknown as RecordingRow) };
}
