import type { DisplaySegment, Transcript, TranscriptSegment } from "@/lib/types";

export interface SpeakerColor {
  text: string;
  bg: string;
  border: string;
  solid: string;
}

export const SPEAKER_PALETTE: SpeakerColor[] = [
  { text: "#E63F00", bg: "#FFF4EE", border: "#FFD2BC", solid: "#FF4D00" },
  { text: "#1D4ED8", bg: "#EFF4FF", border: "#C9D8FF", solid: "#2563EB" },
  { text: "#0F766E", bg: "#ECFDF5", border: "#BBF7D0", solid: "#0E9F6E" },
  { text: "#6D28D9", bg: "#F5F0FF", border: "#DDD0FF", solid: "#7C3AED" },
  { text: "#A21CAF", bg: "#FDF0FF", border: "#F5C6FB", solid: "#C026D3" },
  { text: "#B45309", bg: "#FFFBEB", border: "#FDE68A", solid: "#D97706" },
  { text: "#0369A1", bg: "#F0F9FF", border: "#BAE6FD", solid: "#0284C7" },
  { text: "#BE123C", bg: "#FFF1F2", border: "#FECDD3", solid: "#E11D48" },
];

const FALLBACK_LABEL = "Говорящий";

export function speakerColor(index: number): SpeakerColor {
  return SPEAKER_PALETTE[((index % SPEAKER_PALETTE.length) + SPEAKER_PALETTE.length) % SPEAKER_PALETTE.length]!;
}

export function segmentLabel(
  segment: TranscriptSegment,
  index: number,
  overrides: Record<string, string>,
): string {
  const override = overrides[String(index)] ?? overrides[index as unknown as string];
  if (override?.trim()) return override.trim();
  return segment.speaker?.trim() || FALLBACK_LABEL;
}

export function speakerDisplayName(label: string, names: Record<string, string>): string {
  return names[label]?.trim() || label;
}

export function markTouches(
  mark: { start: number; end: number },
  from: number,
  to: number,
): boolean {
  const length = mark.end - mark.start;
  if (length < 0.05) return mark.start >= from && mark.start <= to;
  return Math.min(mark.end, to) - Math.max(mark.start, from) > 0.05;
}

export function buildDisplaySegments(
  transcript: Transcript | null,
  names: Record<string, string>,
  overrides: Record<string, string>,
  marks: { start: number; end: number }[],
): DisplaySegment[] {
  if (!transcript?.segments?.length) return [];
  const labelOrder = new Map<string, number>();
  return transcript.segments.map((segment, index) => {
    const label = segmentLabel(segment, index, overrides);
    if (!labelOrder.has(label)) labelOrder.set(label, labelOrder.size);
    const name = speakerDisplayName(label, names);
    return {
      index,
      start: segment.start,
      end: segment.end,
      label,
      name,
      text: segment.text,
      marked: marks.some((mark) => markTouches(mark, segment.start, segment.end)),
      colorIndex: labelOrder.get(label) ?? 0,
    };
  });
}

export function uniqueSpeakerNames(segments: DisplaySegment[]): { label: string; name: string; colorIndex: number }[] {
  const seen = new Map<string, { label: string; name: string; colorIndex: number }>();
  for (const segment of segments) {
    if (!seen.has(segment.label)) {
      seen.set(segment.label, {
        label: segment.label,
        name: segment.name,
        colorIndex: segment.colorIndex,
      });
    }
  }
  return [...seen.values()];
}

export function activeSegmentIndex(segments: DisplaySegment[], time: number): number {
  if (!segments.length) return -1;
  let low = 0;
  let high = segments.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const segment = segments[mid]!;
    if (time < segment.start) {
      high = mid - 1;
    } else if (time > segment.end) {
      low = mid + 1;
    } else {
      found = mid;
      break;
    }
  }
  if (found >= 0) return found;
  // Между фразами: показываем предыдущую, чтобы текст не «прыгал».
  let previous = -1;
  for (let i = 0; i < segments.length; i += 1) {
    if (segments[i]!.start <= time) previous = i;
    else break;
  }
  return previous;
}
