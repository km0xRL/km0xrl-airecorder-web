import { randomUUID } from "node:crypto";
import { getDb, inTransaction, nextSeq, type RecordingRow, type ShareRow } from "@/lib/db";
import type { NormalizedIngest } from "@/lib/ingest";
import { randomToken } from "@/lib/crypto";
import type {
  AudioInfo,
  Mark,
  MeetingReport,
  Recording,
  RecordingKind,
  RecordingStats,
  RecordingSummary,
  ShareLink,
  ShareStatus,
  Transcript,
  Hint,
} from "@/lib/types";

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function asKind(value: string): RecordingKind {
  return value === "online_call" || value === "phone_call" ? value : "meeting";
}

export function rowToRecording(row: RecordingRow): Recording {
  return {
    id: row.id,
    clientId: row.client_id,
    title: row.title,
    kind: asKind(row.kind),
    sourceName: row.source_name,
    originDevice: row.origin_device,
    model: row.model,
    recordedAtMs: row.recorded_at_ms,
    durationS: row.duration_s,
    tags: parseJson<string[]>(row.tags_json, []),
    tagsEdited: Boolean(row.tags_edited),
    voiceNamed: parseJson<string[]>(row.voice_named_json, []),
    speakerNames: parseJson<Record<string, string>>(row.speaker_names_json, {}),
    speakerOverrides: parseJson<Record<string, string>>(row.speaker_overrides_json, {}),
    transcript: parseJson<Transcript | null>(row.transcript_json, null),
    report: parseJson<MeetingReport | null>(row.report_json, null),
    marks: parseJson<Mark[]>(row.marks_json, []),
    hints: parseJson<Hint[]>(row.hints_json, []),
    audio: row.audio_path
      ? {
          mime: row.audio_mime ?? "audio/mp4",
          size: row.audio_size ?? 0,
          sha256: row.audio_sha256,
          name: row.audio_name,
        }
      : null,
    seq: Number(row.seq ?? 0),
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
    deletedAtMs: row.deleted_at_ms,
  };
}

export function rowToSummary(row: RecordingRow & { share_count?: number }): RecordingSummary {
  return {
    id: row.id,
    clientId: row.client_id,
    title: row.title,
    kind: asKind(row.kind),
    recordedAtMs: row.recorded_at_ms,
    durationS: row.duration_s,
    tags: parseJson<string[]>(row.tags_json, []),
    originDevice: row.origin_device,
    hasAudio: Boolean(row.audio_path),
    hasTranscript: Boolean(row.transcript_json),
    hasReport: Boolean(row.report_json),
    updatedAtMs: row.updated_at_ms,
    shareCount: row.share_count ?? 0,
  };
}

export function rowToShare(row: ShareRow): ShareLink {
  return {
    id: row.id,
    recordingId: row.recording_id,
    token: row.token,
    label: row.label,
    createdAtMs: row.created_at_ms,
    expiresAtMs: row.expires_at_ms,
    revokedAtMs: row.revoked_at_ms,
    lastAccessAtMs: row.last_access_at_ms,
    accessCount: row.access_count,
  };
}

export function shareStatus(share: ShareLink, now = Date.now()): ShareStatus {
  if (share.revokedAtMs) return "revoked";
  if (share.expiresAtMs != null && share.expiresAtMs <= now) return "expired";
  return "active";
}

export function listRecordings(options: {
  query?: string | null;
  kind?: RecordingKind | null;
  limit?: number;
} = {}): RecordingSummary[] {
  const db = getDb();
  const clauses: string[] = ["r.deleted_at_ms IS NULL"];
  const params: (string | number)[] = [];
  if (options.kind) {
    clauses.push("r.kind = ?");
    params.push(options.kind);
  }
  const query = options.query?.trim();
  if (query) {
    clauses.push("instr(r.search_text, ?) > 0");
    params.push(query.toLocaleLowerCase("ru-RU"));
  }
  const limit = Math.min(Math.max(options.limit ?? 500, 1), 2000);
  const rows = db
    .prepare(
      `SELECT r.*,
        (SELECT COUNT(*) FROM share_links s
          WHERE s.recording_id = r.id
            AND s.revoked_at_ms IS NULL
            AND (s.expires_at_ms IS NULL OR s.expires_at_ms > ?)) AS share_count
       FROM recordings r
       WHERE ${clauses.join(" AND ")}
       ORDER BY COALESCE(r.recorded_at_ms, r.created_at_ms) DESC
       LIMIT ?`,
    )
    .all(Date.now(), ...params, limit) as unknown as (RecordingRow & { share_count: number })[];
  return rows.map(rowToSummary);
}

export function listRecordingsForSync(
  sinceMs: number,
  limit: number,
): (RecordingSummary & { deleted: boolean })[] {
  const db = getDb();
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  const rows = db
    .prepare(
      `SELECT r.*,
        (SELECT COUNT(*) FROM share_links s
          WHERE s.recording_id = r.id
            AND s.revoked_at_ms IS NULL
            AND (s.expires_at_ms IS NULL OR s.expires_at_ms > ?)) AS share_count
       FROM recordings r
       WHERE r.updated_at_ms > ?
       ORDER BY r.updated_at_ms ASC
       LIMIT ?`,
    )
    .all(Date.now(), sinceMs, safeLimit) as unknown as (RecordingRow & { share_count: number })[];
  return rows.map((row) => ({ ...rowToSummary(row), deleted: row.deleted_at_ms != null }));
}

export function getRecording(id: string): Recording | null {
  const row = getDb()
    .prepare("SELECT * FROM recordings WHERE id = ? AND deleted_at_ms IS NULL")
    .get(id) as unknown as RecordingRow | undefined;
  return row ? rowToRecording(row) : null;
}

export function getRecordingByClientId(clientId: string): Recording | null {
  const row = getDb()
    .prepare("SELECT * FROM recordings WHERE client_id = ? AND deleted_at_ms IS NULL")
    .get(clientId) as unknown as RecordingRow | undefined;
  return row ? rowToRecording(row) : null;
}

export function getRecordingRowByClientId(clientId: string): RecordingRow | null {
  const row = getDb()
    .prepare("SELECT * FROM recordings WHERE client_id = ?")
    .get(clientId) as unknown as RecordingRow | undefined;
  return row ?? null;
}

export function getStoredAudio(recordingId: string): {
  relativePath: string;
  mime: string;
  name: string | null;
  size: number;
} | null {
  const row = getDb()
    .prepare(
      "SELECT audio_path, audio_mime, audio_name, audio_size FROM recordings WHERE id = ? AND deleted_at_ms IS NULL",
    )
    .get(recordingId) as
    | Pick<RecordingRow, "audio_path" | "audio_mime" | "audio_name" | "audio_size">
    | undefined;
  if (!row?.audio_path) return null;
  return {
    relativePath: row.audio_path,
    mime: row.audio_mime ?? "audio/mp4",
    name: row.audio_name,
    size: row.audio_size ?? 0,
  };
}

export interface UpsertResult {
  recording: Recording;
  created: boolean;
  skipped: boolean;
}

export function upsertIngest(clientId: string, input: NormalizedIngest): UpsertResult {
  const db = getDb();
  const existing = getRecordingRowByClientId(clientId);

  if (existing && !input.deleted && input.updatedAtMs < existing.updated_at_ms) {
    return { recording: rowToRecording(existing), created: false, skipped: true };
  }

  const now = Date.now();
  if (input.deleted) {
    if (!existing) {
      throw new Error("recording_not_found");
    }
    inTransaction(db, () => {
      const seq = nextSeq(db);
      const at = Math.max(now, input.updatedAtMs);
      db.prepare(
        "UPDATE recordings SET deleted_at_ms = ?, updated_at_ms = ?, seq = ? WHERE id = ?",
      ).run(at, at, seq, existing.id);
      db.prepare(
        "UPDATE share_links SET revoked_at_ms = ? WHERE recording_id = ? AND revoked_at_ms IS NULL",
      ).run(now, existing.id);
    });
    const deletedRow = db.prepare("SELECT * FROM recordings WHERE id = ?").get(existing.id) as unknown as RecordingRow;
    return { recording: rowToRecording(deletedRow), created: false, skipped: false };
  }

  const transcript = input.transcript ?? parseJson<Transcript | null>(existing?.transcript_json ?? null, null);
  const report = input.report ?? parseJson<MeetingReport | null>(existing?.report_json ?? null, null);
  const durationS = input.durationS ?? existing?.duration_s ?? null;
  const recordedAtMs = input.recordedAtMs ?? existing?.recorded_at_ms ?? now;
  const speakerNames = input.speakerNames;
  const speakerOverrides = input.speakerOverrides;
  const searchText = [
    input.title,
    input.tags.join(" "),
    transcript?.text ?? "",
    report?.summary.join(" ") ?? "",
    report?.decisions.join(" ") ?? "",
    report?.tasks.map((task) => `${task.title} ${task.assignee ?? ""}`).join(" ") ?? "",
    report?.markdown ?? "",
  ]
    .join("\n")
    .toLocaleLowerCase("ru-RU")
    .replace(/\s+/g, " ")
    .trim();

  inTransaction(db, () => {
    if (existing) {
      db.prepare(
        `UPDATE recordings SET
          title = ?, kind = ?, source_name = ?, origin_device = ?, model = ?,
          recorded_at_ms = ?, duration_s = ?, tags_json = ?, tags_edited = ?,
          voice_named_json = ?, speaker_names_json = ?,
          speaker_overrides_json = ?, transcript_json = ?, report_json = ?,
          marks_json = ?, hints_json = ?, search_text = ?, updated_at_ms = ?, seq = ?,
          deleted_at_ms = NULL
        WHERE id = ?`,
      ).run(
        input.title,
        input.kind,
        input.sourceName,
        input.originDevice,
        input.model,
        recordedAtMs,
        durationS,
        JSON.stringify(input.tags),
        input.tagsEdited ? 1 : 0,
        JSON.stringify(input.voiceNamed),
        JSON.stringify(speakerNames),
        JSON.stringify(speakerOverrides),
        transcript ? JSON.stringify(transcript) : null,
        report ? JSON.stringify(report) : null,
        JSON.stringify(input.marks),
        JSON.stringify(input.hints),
        searchText,
        Math.max(input.updatedAtMs, existing.updated_at_ms),
        nextSeq(db),
        existing.id,
      );
    } else {
      db.prepare(
        `INSERT INTO recordings (
          id, client_id, title, kind, source_name, origin_device, model,
          recorded_at_ms, duration_s, tags_json, tags_edited, voice_named_json,
          speaker_names_json, speaker_overrides_json, transcript_json, report_json,
          marks_json, hints_json, search_text, created_at_ms, updated_at_ms, seq
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        randomUUID(),
        input.clientId,
        input.title,
        input.kind,
        input.sourceName,
        input.originDevice,
        input.model,
        recordedAtMs,
        durationS,
        JSON.stringify(input.tags),
        input.tagsEdited ? 1 : 0,
        JSON.stringify(input.voiceNamed),
        JSON.stringify(speakerNames),
        JSON.stringify(speakerOverrides),
        transcript ? JSON.stringify(transcript) : null,
        report ? JSON.stringify(report) : null,
        JSON.stringify(input.marks),
        JSON.stringify(input.hints),
        searchText,
        now,
        input.updatedAtMs,
        nextSeq(db),
      );
    }
  });

  const row = db.prepare("SELECT * FROM recordings WHERE client_id = ?").get(clientId) as unknown as RecordingRow;
  return { recording: rowToRecording(row), created: !existing, skipped: false };
}

export function updateRecordingFields(
  id: string,
  patch: {
    title?: string;
    tags?: string[];
    speakerNames?: Record<string, string>;
    speakerOverrides?: Record<string, string>;
    marks?: Mark[];
  },
): Recording | null {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM recordings WHERE id = ? AND deleted_at_ms IS NULL").get(id) as
    | RecordingRow
    | undefined;
  if (!existing) return null;
  const title = patch.title?.trim() || existing.title;
  const tags = patch.tags ?? parseJson<string[]>(existing.tags_json, []);
  const speakerNames = patch.speakerNames ?? parseJson<Record<string, string>>(existing.speaker_names_json, {});
  const speakerOverrides =
    patch.speakerOverrides ?? parseJson<Record<string, string>>(existing.speaker_overrides_json, {});
  const marks = (patch.marks ?? parseJson<Mark[]>(existing.marks_json, [])).slice(0, 500);
  const transcript = parseJson<Transcript | null>(existing.transcript_json, null);
  const report = parseJson<MeetingReport | null>(existing.report_json, null);
  const searchText = [
    title,
    tags.join(" "),
    Object.values(speakerNames).join(" "),
    transcript?.text ?? "",
    report?.summary.join(" ") ?? "",
    report?.decisions.join(" ") ?? "",
    report?.tasks.map((task) => task.title).join(" ") ?? "",
    report?.markdown ?? "",
  ]
    .join("\n")
    .toLocaleLowerCase("ru-RU")
    .replace(/\s+/g, " ")
    .trim();
  const tagsEdited = patch.tags !== undefined ? 1 : existing.tags_edited;
  const updatedAtMs = Math.max(Date.now(), existing.updated_at_ms + 1);
  db.prepare(
    `UPDATE recordings SET
      title = ?, tags_json = ?, tags_edited = ?,
      speaker_names_json = ?, speaker_overrides_json = ?, marks_json = ?,
      search_text = ?, updated_at_ms = ?, seq = ?
    WHERE id = ?`,
  ).run(
    title.slice(0, 300),
    JSON.stringify(tags.slice(0, 50)),
    tagsEdited,
    JSON.stringify(speakerNames),
    JSON.stringify(speakerOverrides),
    JSON.stringify(marks),
    searchText,
    updatedAtMs,
    nextSeq(db),
    id,
  );
  const row = db.prepare("SELECT * FROM recordings WHERE id = ?").get(id) as unknown as RecordingRow;
  return rowToRecording(row);
}

export function setRecordingAudio(
  id: string,
  audio: {
    relativePath: string;
    mime: string;
    size: number;
    sha256: string;
    name: string | null;
    durationS: number | null;
  },
): { previousPath: string | null } {
  const db = getDb();
  const existing = db.prepare("SELECT audio_path, duration_s FROM recordings WHERE id = ?").get(id) as
    | Pick<RecordingRow, "audio_path" | "duration_s">
    | undefined;
  if (!existing) throw new Error("recording_not_found");
  db.prepare(
    `UPDATE recordings SET
      audio_path = ?, audio_mime = ?, audio_size = ?, audio_sha256 = ?, audio_name = ?,
      duration_s = COALESCE(?, duration_s), updated_at_ms = ?, seq = ?
     WHERE id = ?`,
  ).run(
    audio.relativePath,
    audio.mime,
    audio.size,
    audio.sha256,
    audio.name,
    audio.durationS,
    Date.now(),
    nextSeq(db),
    id,
  );
  return { previousPath: existing.audio_path };
}

export function clearRecordingAudio(id: string): string | null {
  const db = getDb();
  const existing = db.prepare("SELECT audio_path FROM recordings WHERE id = ?").get(id) as
    | Pick<RecordingRow, "audio_path">
    | undefined;
  if (!existing) return null;
  db.prepare(
    "UPDATE recordings SET audio_path = NULL, audio_mime = NULL, audio_size = NULL, audio_sha256 = NULL, audio_name = NULL, updated_at_ms = ?, seq = ? WHERE id = ?",
  ).run(Date.now(), nextSeq(db), id);
  return existing.audio_path;
}

export function softDeleteRecording(
  id: string,
  deletedAtMs = Date.now(),
): { found: boolean; audioPath: string | null } {
  const db = getDb();
  const existing = db.prepare("SELECT audio_path FROM recordings WHERE id = ? AND deleted_at_ms IS NULL").get(id) as
    | Pick<RecordingRow, "audio_path">
    | undefined;
  if (!existing) return { found: false, audioPath: null };
  const now = Date.now();
  const at = Math.max(now, deletedAtMs);
  inTransaction(db, () => {
    db.prepare("UPDATE recordings SET deleted_at_ms = ?, updated_at_ms = ?, seq = ? WHERE id = ?").run(
      at,
      at,
      nextSeq(db),
      id,
    );
    db.prepare(
      "UPDATE share_links SET revoked_at_ms = ? WHERE recording_id = ? AND revoked_at_ms IS NULL",
    ).run(now, id);
  });
  return { found: true, audioPath: existing.audio_path };
}

export function getStats(): RecordingStats {
  const db = getDb();
  const recordingStats = db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(duration_s), 0) AS duration,
              COALESCE(SUM(audio_size), 0) AS bytes,
              COALESCE(SUM(CASE WHEN audio_path IS NOT NULL THEN 1 ELSE 0 END), 0) AS audio_count,
              MAX(COALESCE(recorded_at_ms, created_at_ms)) AS latest
       FROM recordings WHERE deleted_at_ms IS NULL`,
    )
    .get() as { count: number; duration: number; bytes: number; audio_count: number; latest: number | null };
  const shares = db
    .prepare(
      `SELECT COUNT(*) AS count FROM share_links s
       JOIN recordings r ON r.id = s.recording_id
       WHERE s.revoked_at_ms IS NULL
         AND (s.expires_at_ms IS NULL OR s.expires_at_ms > ?)
         AND r.deleted_at_ms IS NULL`,
    )
    .get(Date.now()) as { count: number };
  return {
    recordings: recordingStats.count,
    durationS: recordingStats.duration,
    audioBytes: recordingStats.bytes,
    audioRecordings: recordingStats.audio_count,
    activeShares: shares.count,
    latestAtMs: recordingStats.latest,
  };
}

// --- Ссылки для sharing ---

export function listSharesForRecording(recordingId: string): ShareLink[] {
  const rows = getDb()
    .prepare("SELECT * FROM share_links WHERE recording_id = ? ORDER BY created_at_ms DESC")
    .all(recordingId) as unknown as ShareRow[];
  return rows.map(rowToShare);
}

export function getShareByToken(token: string): ShareLink | null {
  const row = getDb().prepare("SELECT * FROM share_links WHERE token = ?").get(token) as unknown as ShareRow | undefined;
  return row ? rowToShare(row) : null;
}

export function getShareById(id: string): ShareLink | null {
  const row = getDb().prepare("SELECT * FROM share_links WHERE id = ?").get(id) as unknown as ShareRow | undefined;
  return row ? rowToShare(row) : null;
}

export function createShare(input: {
  recordingId: string;
  passwordHash: string;
  label: string | null;
  expiresAtMs: number | null;
}): ShareLink {
  const db = getDb();
  const id = randomUUID();
  const token = randomToken(32);
  const now = Date.now();
  db.prepare(
    `INSERT INTO share_links
      (id, recording_id, token, password_hash, label, created_at_ms, expires_at_ms, revoked_at_ms, last_access_at_ms, access_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0)`,
  ).run(id, input.recordingId, token, input.passwordHash, input.label, now, input.expiresAtMs);
  return rowToShare(
    db.prepare("SELECT * FROM share_links WHERE id = ?").get(id) as unknown as ShareRow,
  );
}

export function getShareRow(id: string): ShareRow | null {
  const row = getDb().prepare("SELECT * FROM share_links WHERE id = ?").get(id) as unknown as ShareRow | undefined;
  return row ?? null;
}

export function revokeShare(id: string): ShareLink | null {
  const db = getDb();
  const now = Date.now();
  const result = db
    .prepare("UPDATE share_links SET revoked_at_ms = ? WHERE id = ? AND revoked_at_ms IS NULL")
    .run(now, id);
  if (result.changes === 0) return getShareById(id);
  return getShareById(id);
}

export function restoreShare(id: string): ShareLink | null {
  getDb().prepare("UPDATE share_links SET revoked_at_ms = NULL WHERE id = ?").run(id);
  return getShareById(id);
}

export function setSharePassword(id: string, passwordHash: string): ShareLink | null {
  getDb().prepare("UPDATE share_links SET password_hash = ? WHERE id = ?").run(passwordHash, id);
  return getShareById(id);
}

export function setShareLabel(id: string, label: string | null): ShareLink | null {
  getDb().prepare("UPDATE share_links SET label = ? WHERE id = ?").run(label, id);
  return getShareById(id);
}

export function setShareExpiry(id: string, expiresAtMs: number | null): ShareLink | null {
  getDb().prepare("UPDATE share_links SET expires_at_ms = ? WHERE id = ?").run(expiresAtMs, id);
  return getShareById(id);
}

export function touchShare(id: string): void {
  getDb()
    .prepare("UPDATE share_links SET access_count = access_count + 1, last_access_at_ms = ? WHERE id = ?")
    .run(Date.now(), id);
}

export function revokeSharesForRecording(recordingId: string): void {
  getDb()
    .prepare("UPDATE share_links SET revoked_at_ms = ? WHERE recording_id = ? AND revoked_at_ms IS NULL")
    .run(Date.now(), recordingId);
}

export function deleteSharePermanently(id: string): void {
  getDb().prepare("DELETE FROM share_links WHERE id = ?").run(id);
}
