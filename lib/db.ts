import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { paths } from "@/lib/config";
import { buildSearchText } from "@/lib/search";
import type { Hint, MeetingReport, Transcript } from "@/lib/types";

export interface RecordingRow {
  id: string;
  client_id: string;
  title: string;
  kind: string;
  source_name: string | null;
  origin_device: string | null;
  model: string | null;
  recorded_at_ms: number | null;
  duration_s: number | null;
  tags_json: string;
  speaker_names_json: string;
  speaker_overrides_json: string;
  transcript_json: string | null;
  report_json: string | null;
  marks_json: string;
  hints_json: string;
  audio_path: string | null;
  audio_mime: string | null;
  audio_size: number | null;
  audio_sha256: string | null;
  audio_name: string | null;
  tags_edited: number;
  voice_named_json: string;
  seq: number;
  search_text: string;
  created_at_ms: number;
  updated_at_ms: number;
  deleted_at_ms: number | null;
}

export interface ShareRow {
  id: string;
  recording_id: string;
  token: string;
  password_hash: string;
  label: string | null;
  created_at_ms: number;
  expires_at_ms: number | null;
  revoked_at_ms: number | null;
  last_access_at_ms: number | null;
  access_count: number;
}

type Db = DatabaseSync;

const globalForDb = globalThis as typeof globalThis & { __airRecorderDb?: Db };

function migrate(db: Db): void {
  const versionRow = db.prepare("PRAGMA user_version").get() as { user_version?: number } | undefined;
  const version = Number(versionRow?.user_version ?? 0);

  if (version < 1) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'meeting',
      source_name TEXT,
      origin_device TEXT,
      model TEXT,
      recorded_at_ms INTEGER,
      duration_s REAL,
      tags_json TEXT NOT NULL DEFAULT '[]',
      speaker_names_json TEXT NOT NULL DEFAULT '{}',
      speaker_overrides_json TEXT NOT NULL DEFAULT '{}',
      transcript_json TEXT,
      report_json TEXT,
      marks_json TEXT NOT NULL DEFAULT '[]',
      hints_json TEXT NOT NULL DEFAULT '[]',
      audio_path TEXT,
      audio_mime TEXT,
      audio_size INTEGER,
      audio_sha256 TEXT,
      audio_name TEXT,
      search_text TEXT NOT NULL DEFAULT '',
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      deleted_at_ms INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_recordings_recorded
      ON recordings(recorded_at_ms DESC);
    CREATE INDEX IF NOT EXISTS idx_recordings_updated
      ON recordings(updated_at_ms);
    CREATE INDEX IF NOT EXISTS idx_recordings_deleted
      ON recordings(deleted_at_ms);

    CREATE TABLE IF NOT EXISTS share_links (
      id TEXT PRIMARY KEY,
      recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      label TEXT,
      created_at_ms INTEGER NOT NULL,
      expires_at_ms INTEGER,
      revoked_at_ms INTEGER,
      last_access_at_ms INTEGER,
      access_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_share_recording
      ON share_links(recording_id);
    CREATE INDEX IF NOT EXISTS idx_share_token
      ON share_links(token);

    PRAGMA user_version = 1;
  `);
  }

  if (version < 2) {
    db.exec(`
      ALTER TABLE recordings ADD COLUMN tags_edited INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE recordings ADD COLUMN voice_named_json TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE recordings ADD COLUMN seq INTEGER NOT NULL DEFAULT 0;
      UPDATE recordings SET seq = rowid WHERE seq = 0;
      CREATE INDEX IF NOT EXISTS idx_recordings_seq ON recordings(seq);
      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      );
      INSERT OR IGNORE INTO sync_state(key, value)
        SELECT 'seq', COALESCE(MAX(seq), 0) FROM recordings;
      PRAGMA user_version = 2;
    `);
  }

  if (version < 3) {
    // Пересобрать поисковый текст: добавляем говорящих, исходное имя файла, подсказки и теги отчёта.
    const rows = db.prepare(
      `SELECT id, title, source_name, tags_json, transcript_json, report_json,
              speaker_names_json, speaker_overrides_json, hints_json
       FROM recordings`,
    ).all() as unknown as {
      id: string;
      title: string;
      source_name: string | null;
      tags_json: string;
      transcript_json: string | null;
      report_json: string | null;
      speaker_names_json: string;
      speaker_overrides_json: string;
      hints_json: string;
    }[];
    const update = db.prepare("UPDATE recordings SET search_text = ? WHERE id = ?");
    for (const row of rows) {
      update.run(
        buildSearchText({
          title: row.title,
          sourceName: row.source_name,
          tags: parseJson<string[]>(row.tags_json, []),
          transcript: parseJson<Transcript | null>(row.transcript_json, null),
          report: parseJson<MeetingReport | null>(row.report_json, null),
          speakerNames: parseJson<Record<string, string>>(row.speaker_names_json, {}),
          speakerOverrides: parseJson<Record<string, string>>(row.speaker_overrides_json, {}),
          hints: parseJson<Hint[]>(row.hints_json, []),
        }),
        row.id,
      );
    }
    db.exec("PRAGMA user_version = 3");
  }
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function nextSeq(db: Db): number {
  db.prepare("UPDATE sync_state SET value = value + 1 WHERE key = 'seq'").run();
  const row = db.prepare("SELECT value FROM sync_state WHERE key = 'seq'").get() as
    | { value?: number }
    | undefined;
  return Number(row?.value ?? 1);
}

export function getDb(): Db {
  if (globalForDb.__airRecorderDb) return globalForDb.__airRecorderDb;

  fs.mkdirSync(paths.db, { recursive: true });
  const db = new DatabaseSync(path.join(/* turbopackIgnore: true */ paths.db, "app.db"));
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  migrate(db);

  globalForDb.__airRecorderDb = db;
  return db;
}

/** Явная транзакция: в node:sqlite нет хелпера .transaction(), как в better-sqlite3. */
export function inTransaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Если транзакция уже закрыта — не заслоняем исходную ошибку.
    }
    throw error;
  }
}

export function closeDbForTests(): void {
  if (globalForDb.__airRecorderDb) {
    globalForDb.__airRecorderDb.close();
    delete globalForDb.__airRecorderDb;
  }
}
