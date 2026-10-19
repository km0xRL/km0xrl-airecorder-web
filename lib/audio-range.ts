export interface ByteRange {
  start: number;
  end: number;
}

export type RangeResult = ByteRange | null | "invalid";

/**
 * Разбирает заголовок Range. Возвращает:
 * - null — заголовка нет, отдать файл целиком;
 * - "invalid" — диапазон невозможен, ответ 416;
 * - {start, end} — включительный диапазон.
 */
export function parseRange(header: string | null | undefined, size: number): RangeResult {
  if (!header) return null;
  if (!Number.isFinite(size) || size < 0) return "invalid";
  const trimmed = header.trim();
  const match = /^bytes=(.+)$/i.exec(trimmed);
  if (!match) return "invalid";
  const spec = match[1]!.trim();
  if (!spec || spec.includes(",")) return "invalid";
  const dash = spec.indexOf("-");
  if (dash < 0) return "invalid";
  const startRaw = spec.slice(0, dash).trim();
  const endRaw = spec.slice(dash + 1).trim();

  if (startRaw === "") {
    const suffix = Number(endRaw);
    if (!Number.isInteger(suffix) || suffix <= 0) return "invalid";
    if (size === 0) return "invalid";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(startRaw);
  if (!Number.isInteger(start) || start < 0) return "invalid";
  if (size === 0 || start >= size) return "invalid";

  if (endRaw === "") return { start, end: size - 1 };

  const end = Number(endRaw);
  if (!Number.isInteger(end) || end < start) return "invalid";
  return { start, end: Math.min(end, size - 1) };
}
