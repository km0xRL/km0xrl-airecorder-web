export type RecordingKind = "meeting" | "online_call" | "phone_call";

export interface TranscriptSegment {
  start: number;
  end: number;
  speaker: string | null;
  text: string;
}

export interface TranscriptChunk {
  seq: number;
  page?: number | null;
  text: string;
}

export interface Transcript {
  id?: string | null;
  text: string;
  duration_s?: number | null;
  model?: string | null;
  language?: string | null;
  segments: TranscriptSegment[];
  chunks?: TranscriptChunk[];
  warnings?: unknown[];
}

export interface ReportTask {
  title: string;
  assignee?: string | null;
  due?: string | null;
}

export interface MeetingReport {
  title?: string | null;
  summary: string[];
  decisions: string[];
  tasks: ReportTask[];
  tags: string[];
  markdown?: string | null;
  model?: string | null;
}

export interface Mark {
  start: number;
  end: number;
}

export interface Hint {
  key?: string;
  kind?: string;
  start?: number;
  end?: number;
  text: string;
  quote?: string;
  mark?: boolean;
}

export interface AudioInfo {
  mime: string;
  size: number;
  sha256: string | null;
  name: string | null;
}

/** Полная запись для серверного рендера. Путь к аудио наружу не отдаётся. */
export interface Recording {
  id: string;
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
  audio: AudioInfo | null;
  seq: number;
  createdAtMs: number;
  updatedAtMs: number;
  deletedAtMs: number | null;
}

export interface RecordingSummary {
  id: string;
  clientId: string;
  title: string;
  kind: RecordingKind;
  recordedAtMs: number | null;
  durationS: number | null;
  tags: string[];
  originDevice: string | null;
  hasAudio: boolean;
  hasTranscript: boolean;
  hasReport: boolean;
  updatedAtMs: number;
  shareCount: number;
}

export interface ShareLink {
  id: string;
  recordingId: string;
  token: string;
  label: string | null;
  createdAtMs: number;
  expiresAtMs: number | null;
  revokedAtMs: number | null;
  lastAccessAtMs: number | null;
  accessCount: number;
}

export type ShareStatus = "active" | "expired" | "revoked";

export interface ShareLinkView extends ShareLink {
  status: ShareStatus;
  url: string;
}

export interface DisplaySegment {
  index: number;
  start: number;
  end: number;
  label: string;
  name: string;
  text: string;
  marked: boolean;
  colorIndex: number;
}

export interface RecordingStats {
  recordings: number;
  durationS: number;
  audioBytes: number;
  audioRecordings: number;
  activeShares: number;
  latestAtMs: number | null;
}
