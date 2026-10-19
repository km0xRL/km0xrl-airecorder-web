"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Search } from "lucide-react";
import { plural } from "@/lib/format";
import { cn } from "@/lib/cn";
import type {
  RecordingKind,
  RecordingMedia,
  RecordingPeriod,
  RecordingSort,
} from "@/lib/types";

interface FilterState {
  query: string;
  kind: RecordingKind | null;
  period: RecordingPeriod;
  media: RecordingMedia;
  speaker: string;
  sort: RecordingSort;
}

const KIND_OPTIONS: { value: RecordingKind | ""; label: string }[] = [
  { value: "", label: "Все типы" },
  { value: "meeting", label: "Встречи" },
  { value: "online_call", label: "Онлайн-звонки" },
  { value: "phone_call", label: "Звонки" },
];

const PERIOD_OPTIONS: { value: RecordingPeriod; label: string }[] = [
  { value: "all", label: "Всё время" },
  { value: "day", label: "За сутки" },
  { value: "week", label: "За 7 дней" },
  { value: "month", label: "За 30 дней" },
];

const MEDIA_OPTIONS: { value: RecordingMedia; label: string }[] = [
  { value: "all", label: "Все записи" },
  { value: "audio", label: "С аудио" },
  { value: "transcript", label: "С расшифровкой" },
  { value: "report", label: "С отчётом" },
];

const SORT_OPTIONS: { value: RecordingSort; label: string }[] = [
  { value: "date_desc", label: "Сначала новые" },
  { value: "date_asc", label: "Сначала старые" },
  { value: "updated_desc", label: "Недавно обновлённые" },
  { value: "duration_desc", label: "Сначала долгие" },
  { value: "duration_asc", label: "Сначала короткие" },
  { value: "title_asc", label: "По названию А–Я" },
  { value: "speaker_asc", label: "По говорящему А–Я" },
  { value: "speaker_desc", label: "По говорящему Я–А" },
];

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[9px] uppercase tracking-[0.12em] text-ink-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-xl border border-hairline bg-card px-2.5 text-[11.5px] text-ink-600 outline-none transition-colors hover:border-ink-300"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function LibraryFilters({
  query,
  kind,
  period,
  media,
  speaker,
  sort,
  speakers,
  count,
}: {
  query: string;
  kind: RecordingKind | null;
  period: RecordingPeriod;
  media: RecordingMedia;
  speaker: string;
  sort: RecordingSort;
  speakers: { name: string; count: number }[];
  count: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(query);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setValue(query);
  }, [query]);

  const hasFilters = Boolean(
    query || kind || period !== "all" || media !== "all" || speaker || sort !== "date_desc",
  );

  const apply = (patch: Partial<FilterState>) => {
    const next: FilterState = { query: value, kind, period, media, speaker, sort, ...patch };
    const params = new URLSearchParams();
    if (next.query.trim()) params.set("q", next.query.trim());
    if (next.kind) params.set("kind", next.kind);
    if (next.period !== "all") params.set("period", next.period);
    if (next.media !== "all") params.set("media", next.media);
    if (next.speaker) params.set("speaker", next.speaker);
    if (next.sort !== "date_desc") params.set("sort", next.sort);
    startTransition(() => {
      router.push(params.toString() ? `/?${params.toString()}` : "/");
    });
  };

  const reset = () => {
    setValue("");
    startTransition(() => router.push("/"));
  };

  return (
    <div className={cn("mt-9 space-y-3 transition-opacity", pending && "opacity-60")}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply({ query: value });
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-300"
            strokeWidth={1.9}
          />
          <input
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Название, текст, отчёт, тема, говорящий…"
            className="input h-11 pl-10 pr-4"
            aria-label="Поиск по записям"
          />
        </div>
        <button type="submit" className="btn btn-primary h-11 shrink-0">
          <Search className="size-4" strokeWidth={2} />
          Найти
        </button>
        {hasFilters ? (
          <button type="button" onClick={reset} className="btn btn-ghost h-11 shrink-0 text-ink-400">
            <RotateCcw className="size-3.5" strokeWidth={1.9} />
            Сбросить
          </button>
        ) : null}
      </form>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Select
          label="Тип"
          value={kind ?? ""}
          options={KIND_OPTIONS}
          onChange={(next) => apply({ kind: (next || null) as RecordingKind | null })}
        />
        <Select
          label="Период"
          value={period}
          options={PERIOD_OPTIONS}
          onChange={(next) => apply({ period: next as RecordingPeriod })}
        />
        <Select
          label="Содержимое"
          value={media}
          options={MEDIA_OPTIONS}
          onChange={(next) => apply({ media: next as RecordingMedia })}
        />
        <Select
          label="Говорящий"
          value={speaker}
          options={[
            { value: "", label: "Все говорящие" },
            ...(speakers.some((item) => item.name === speaker)
              ? speakers
              : speaker
                ? [...speakers, { name: speaker, count: 0 }]
                : speakers
            ).map((item) => ({
              value: item.name,
              label: item.count ? `${item.name} (${item.count})` : item.name,
            })),
          ]}
          onChange={(next) => apply({ speaker: next })}
        />
        <Select
          label="Сортировка"
          value={sort}
          options={SORT_OPTIONS}
          onChange={(next) => apply({ sort: next as RecordingSort })}
        />
      </div>

      <p className="px-1 text-[11px] text-ink-300">
        {count} {plural(count, "запись", "записи", "записей")}
        {hasFilters ? " по выбранным условиям" : " всего"}
      </p>
    </div>
  );
}
