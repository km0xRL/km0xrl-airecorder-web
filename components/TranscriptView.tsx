"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Highlighter, Pencil, Search, X, LocateFixed, Mic2 } from "lucide-react";
import { usePlayback } from "@/components/PlaybackProvider";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { speakerColor, uniqueSpeakerNames } from "@/lib/speakers";
import type { DisplaySegment } from "@/lib/types";

function highlight(text: string, query: string): ReactNode {
  if (!query) return text;
  const lower = text.toLocaleLowerCase("ru-RU");
  const needle = query.toLocaleLowerCase("ru-RU");
  const parts: ReactNode[] = [];
  let cursor = 0;
  let found = lower.indexOf(needle);
  let key = 0;
  while (found >= 0) {
    if (found > cursor) parts.push(text.slice(cursor, found));
    parts.push(
      <mark key={key} className="rounded bg-orange-soft px-0.5 text-ink">
        {text.slice(found, found + needle.length)}
      </mark>,
    );
    key += 1;
    cursor = found + needle.length;
    found = lower.indexOf(needle, cursor);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts.length ? parts : text;
}

export function TranscriptView({
  segments,
  text,
  hasAudio,
  canEdit = false,
  recordingId,
  speakerOverrides = {},
}: {
  segments: DisplaySegment[];
  text: string | null;
  hasAudio: boolean;
  canEdit?: boolean;
  recordingId?: string;
  speakerOverrides?: Record<string, string>;
}) {
  const { activeIndex, playing, seekTo } = usePlayback();
  const router = useRouter();
  const [savingSpeaker, setSavingSpeaker] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [speaker, setSpeaker] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  const speakers = useMemo(() => uniqueSpeakerNames(segments), [segments]);
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");

  const editSpeaker = async (segment: DisplaySegment) => {
    if (!canEdit || !recordingId || savingSpeaker !== null) return;
    const value = window.prompt(
      "Имя говорящего для этой фразы. Пусто — имя как у всех.",
      segment.name,
    );
    if (value === null) return;
    const next = { ...speakerOverrides };
    if (value.trim()) next[String(segment.index)] = value.trim();
    else delete next[String(segment.index)];
    setSavingSpeaker(segment.index);
    try {
      const response = await fetch(`/api/recordings/${recordingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speaker_overrides: next }),
      });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "Не удалось сохранить имя");
      router.refresh();
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "Не удалось сохранить имя");
    } finally {
      setSavingSpeaker(null);
    }
  };

  const filtered = useMemo(() => {
    return segments.filter((segment) => {
      if (speaker && segment.label !== speaker) return false;
      if (normalizedQuery && !segment.text.toLocaleLowerCase("ru-RU").includes(normalizedQuery)) return false;
      return true;
    });
  }, [segments, speaker, normalizedQuery]);

  useEffect(() => {
    if (!follow || !playing || activeIndex < 0) return;
    const element = refs.current[activeIndex];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIndex, follow, playing]);

  if (!segments.length) {
    if (!text) {
      return (
        <div className="card-flat flex flex-col items-center px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-sunken text-ink-300">
            <Mic2 className="size-5" strokeWidth={1.7} />
          </span>
          <p className="mt-4 font-display text-[17px] font-medium text-ink">Расшифровки пока нет</p>
          <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-ink-400">
            Когда приложение пришлёт текст записи, он появится здесь — с таймкодами и говорящими.
          </p>
        </div>
      );
    }
    return (
      <div className="card-flat p-5 sm:p-7">
        <div className="prose-air whitespace-pre-wrap text-[14px] leading-[1.8] text-ink-700">
          {text.split(/\n{2,}/).map((paragraph, index) => (
            <p key={index} className="mb-4 last:mb-0">
              {highlight(paragraph, normalizedQuery)}
            </p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card-flat overflow-hidden">
      <div className="border-b border-hairline px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-[300px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-300" strokeWidth={1.8} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти в расшифровке"
              className="h-9 w-full rounded-full border border-hairline bg-sunken/60 pl-9 pr-8 text-[12px] text-ink outline-none transition-colors placeholder:text-ink-300 focus:border-ink-300 focus:bg-card"
              aria-label="Поиск по расшифровке"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-300 hover:bg-sunken hover:text-ink"
                aria-label="Очистить поиск"
              >
                <X className="size-3" strokeWidth={2} />
              </button>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <span className="mono text-[10px] text-ink-300">
              {normalizedQuery || speaker ? `${filtered.length} из ${segments.length}` : `${segments.length}`} фраз
            </span>
            {hasAudio ? (
              <button
                type="button"
                onClick={() => setFollow((value) => !value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10.5px] font-medium transition-colors",
                  follow ? "bg-orange-tint text-orange-text" : "bg-sunken text-ink-400 hover:text-ink",
                )}
                aria-pressed={follow}
                title="Прокручивать текст за звуком"
              >
                <LocateFixed className="size-3" strokeWidth={1.9} />
                Следовать
              </button>
            ) : null}
          </div>
        </div>

        {speakers.length > 1 ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSpeaker(null)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[10.5px] font-medium transition-colors",
                speaker === null ? "bg-ink text-white" : "bg-sunken text-ink-400 hover:text-ink",
              )}
            >
              Все
            </button>
            {speakers.map((item) => {
              const color = speakerColor(item.colorIndex);
              const active = speaker === item.label;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setSpeaker(active ? null : item.label)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium transition-colors",
                    active ? "bg-ink text-white" : "bg-sunken text-ink-400 hover:text-ink",
                  )}
                >
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: color.solid }} />
                  {item.name}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {filtered.length ? (
        <div className="max-h-none divide-y divide-hairline/70 overflow-visible px-1.5 py-2 sm:px-2.5">
          {filtered.map((segment) => {
            const active = segment.index === activeIndex;
            const color = speakerColor(segment.colorIndex);
            return (
              <div
                key={segment.index}
                ref={(element) => {
                  refs.current[segment.index] = element;
                }}
                role={hasAudio ? "button" : undefined}
                tabIndex={hasAudio ? 0 : undefined}
                onClick={() => {
                  if (hasAudio) seekTo(segment.start);
                }}
                onKeyDown={(event) => {
                  if (!hasAudio) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    seekTo(segment.start);
                  }
                }}
                className={cn(
                  "group relative flex gap-2.5 rounded-xl px-2 py-2.5 transition-colors sm:gap-3.5 sm:px-3",
                  active ? "bg-orange-tint" : "hover:bg-sunken/60",
                  hasAudio ? "cursor-pointer" : "cursor-default",
                  segment.marked && "before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[2px] before:rounded-full before:bg-orange",
                )}
                aria-current={active ? "true" : undefined}
              >
                <span
                  className={cn(
                    "mono mt-0.5 w-[44px] shrink-0 text-right text-[10px] transition-colors sm:w-[52px] sm:text-[11px]",
                    active ? "text-orange-text" : "text-ink-300",
                  )}
                >
                  {formatDuration(segment.start)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color.solid }} />
                    <span className="truncate text-[10.5px] font-medium" style={{ color: color.text }}>
                      {segment.name}
                    </span>
                    {segment.marked ? (
                      <Highlighter className="size-2.5 text-orange" strokeWidth={2} aria-label="Отмечено" />
                    ) : null}
                    {canEdit && recordingId ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void editSpeaker(segment);
                        }}
                        disabled={savingSpeaker === segment.index}
                        className="flex size-4 items-center justify-center rounded-full text-ink-300 opacity-60 transition-opacity hover:text-orange disabled:opacity-30 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                        aria-label="Изменить говорящего для этой фразы"
                        title="Изменить говорящего для этой фразы"
                      >
                        <Pencil className="size-2.5" strokeWidth={2} />
                      </button>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-[13.5px] leading-[1.65] text-ink-700 sm:text-[14px]">
                    {highlight(segment.text, normalizedQuery)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-5 py-12 text-center text-[12.5px] text-ink-400">
          Ничего не нашлось. Попробуйте другое слово или сбросьте фильтр говорящего.
        </div>
      )}
    </div>
  );
}
