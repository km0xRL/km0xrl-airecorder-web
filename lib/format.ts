import type { RecordingKind } from "@/lib/types";

/** В клиентских компонентах нельзя читать серверный config, поэтому часовой пояс — публичная переменная. */
const DISPLAY_TIME_ZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Europe/Moscow";

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: DISPLAY_TIME_ZONE,
});

const dayMonthFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: DISPLAY_TIME_ZONE,
});

const weekdayFmt = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  timeZone: DISPLAY_TIME_ZONE,
});

const timeFmt = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DISPLAY_TIME_ZONE,
});

const dateTimeFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DISPLAY_TIME_ZONE,
});

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: DISPLAY_TIME_ZONE,
});

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function dayKey(ms: number): string {
  return dayKeyFmt.format(new Date(ms));
}

export function formatTimeRu(ms: number): string {
  return timeFmt.format(new Date(ms));
}

export function formatDateRu(ms: number): string {
  return dateFmt.format(new Date(ms));
}

export function formatDateTimeRu(ms: number): string {
  return dateTimeFmt.format(new Date(ms));
}

export function formatDayHeading(ms: number, now = Date.now()): string {
  const today = dayKey(now);
  const yesterday = dayKey(now - 86_400_000);
  const target = dayKey(ms);
  if (target === today) return "Сегодня";
  if (target === yesterday) return "Вчера";
  return `${capitalize(dayMonthFmt.format(new Date(ms)))}, ${weekdayFmt.format(new Date(ms))}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatTimecode(seconds: number): string {
  return formatDuration(Math.max(0, seconds));
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 1) return "0 Б";
  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1).replace(".", ",")} ${units[exponent]}`;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function kindLabel(kind: RecordingKind): string {
  switch (kind) {
    case "phone_call":
      return "Звонок";
    case "online_call":
      return "Онлайн-звонок";
    default:
      return "Встреча";
  }
}

export function formatExpiry(ms: number | null): string {
  if (ms == null) return "бессрочно";
  return formatDateRu(ms);
}

export function formatDurationWords(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} ${plural(Math.round(seconds), "секунда", "секунды", "секунд")}`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} ${plural(minutes, "минута", "минуты", "минут")}`;
}

export function formatHoursTotal(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} мин`;
  const hours = seconds / 3600;
  return `${hours.toFixed(hours >= 10 ? 0 : 1).replace(".", ",")} ч`;
}
