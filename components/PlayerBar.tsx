"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { usePlayback } from "@/components/PlaybackProvider";
import { formatDuration } from "@/lib/format";
import { speakerColor } from "@/lib/speakers";
import { cn } from "@/lib/cn";

function Timeline() {
  const { available, currentTime, duration, segments, marks, seekTo, playing } = usePlayback();
  const railRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const total = duration > 0 ? duration : 1;
  const percent = Math.max(0, Math.min(100, (currentTime / total) * 100));

  const timeAt = (clientX: number): number => {
    const rail = railRef.current;
    if (!rail) return 0;
    const rect = rail.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * total;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!available) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    seekTo(timeAt(event.clientX), false);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !available) return;
    seekTo(timeAt(event.clientX), false);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  return (
    <div
      ref={railRef}
      role="slider"
      tabIndex={available ? 0 : -1}
      aria-label="Позиция записи"
      aria-valuemin={0}
      aria-valuemax={Math.round(total)}
      aria-valuenow={Math.round(currentTime)}
      aria-valuetext={`${formatDuration(currentTime)} из ${formatDuration(total)}`}
      className={cn(
        "group relative h-9 select-none overflow-hidden rounded-xl bg-sunken",
        available ? "cursor-pointer" : "cursor-default opacity-60",
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={(event) => {
        if (!available) return;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          seekTo(currentTime - 5, false);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          seekTo(currentTime + 5, false);
        } else if (event.key === "Home") {
          event.preventDefault();
          seekTo(0, false);
        } else if (event.key === "End") {
          event.preventDefault();
          seekTo(total, false);
        }
      }}
    >
      {segments.length ? (
        segments.map((segment) => {
          const left = Math.max(0, (segment.start / total) * 100);
          const width = Math.max(0.15, ((segment.end - segment.start) / total) * 100);
          const color = speakerColor(segment.colorIndex);
          return (
            <span
              key={segment.index}
              aria-hidden="true"
              className="absolute inset-y-0 border-r border-white/50"
              style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color.solid, opacity: 0.24 }}
            />
          );
        })
      ) : (
        <span className="absolute inset-0 bg-ink/[0.04]" aria-hidden="true" />
      )}

      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 bg-ink/[0.06]"
        style={{ width: `${percent}%` }}
      />

      {marks.map((mark, index) => (
        <span
          key={`${mark.start}-${index}`}
          aria-hidden="true"
          className="absolute inset-y-0 w-[2px] bg-orange/80"
          style={{ left: `${Math.max(0, Math.min(100, (mark.start / total) * 100))}%` }}
        />
      ))}

      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0 h-full w-[2px] bg-ink",
          available ? "opacity-100" : "opacity-0",
          dragging ? "" : "transition-[left] duration-75",
        )}
        style={{ left: `${percent}%` }}
      >
        <span className="absolute -left-[3px] top-1/2 size-2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-white" />
      </span>

      {playing ? (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
          <span className="flex items-end gap-[2px]" aria-hidden="true">
            <span className="h-2 w-[2px] animate-soft-pulse rounded-full bg-ink/30" />
            <span className="h-3 w-[2px] animate-soft-pulse rounded-full bg-ink/30 [animation-delay:120ms]" />
            <span className="h-1.5 w-[2px] animate-soft-pulse rounded-full bg-ink/30 [animation-delay:240ms]" />
          </span>
        </span>
      ) : null}
    </div>
  );
}

export function PlayerBar({
  recordingId,
  canEdit = false,
}: {
  recordingId?: string;
  canEdit?: boolean;
}) {
  const {
    available,
    currentTime,
    duration,
    playing,
    rate,
    error,
    segments,
    marks,
    activeIndex,
    toggle,
    skip,
    setRate,
  } = usePlayback();
  const router = useRouter();
  const [markBusy, setMarkBusy] = useState(false);

  const speaker = activeIndex >= 0 ? segments[activeIndex] : null;
  const color = speaker ? speakerColor(speaker.colorIndex) : null;

  const addMark = async () => {
    if (!recordingId || markBusy) return;
    const segment = activeIndex >= 0 ? segments[activeIndex] : null;
    const start = Math.max(0, segment?.start ?? currentTime);
    const end = Math.max(start, segment?.end ?? currentTime);
    if (marks.some((mark) => Math.abs(mark.start - start) < 0.05 && Math.abs(mark.end - end) < 0.05)) return;
    const next = [...marks, { start, end }].sort((a, b) => a.start - b.start || a.end - b.end);
    setMarkBusy(true);
    try {
      const response = await fetch(`/api/recordings/${recordingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marks: next }),
      });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "Не удалось поставить метку");
      router.refresh();
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "Не удалось поставить метку");
    } finally {
      setMarkBusy(false);
    }
  };

  if (error) {
    return (
      <div className="card flex items-center gap-3 px-4 py-3.5 text-[12.5px] text-ink-400">
        <span className="flex size-8 items-center justify-center rounded-full bg-danger-tint text-danger">!</span>
        Не удалось загрузить аудио. Обновите страницу или откройте запись позже.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex min-w-0 items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn("size-2 shrink-0 rounded-full", playing && "animate-soft-pulse")}
            style={{ backgroundColor: color?.solid ?? "#A3A3A3" }}
            aria-hidden="true"
          />
          <span className="truncate text-[11.5px] font-medium text-ink-500">
            {speaker ? speaker.name : available ? "Аудиозапись" : "Аудио недоступно"}
          </span>
        </div>
        <span className="mono shrink-0 text-[10.5px] text-ink-300">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </span>
      </div>

      <div className="px-2.5 pt-3 sm:px-3.5">
        <Timeline />
      </div>

      <div className="flex items-center justify-between gap-3 px-4 pb-3.5 pt-2 sm:px-5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => skip(-15)}
            disabled={!available}
            className="relative flex size-10 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-sunken hover:text-ink disabled:opacity-40"
            aria-label="Назад на 15 секунд"
            title="−15 секунд"
          >
            <RotateCcw className="size-[18px]" strokeWidth={1.8} />
            <span className="absolute -bottom-0.5 text-[8px] font-medium">15</span>
          </button>
          <button
            type="button"
            onClick={toggle}
            disabled={!available}
            className="flex size-[52px] items-center justify-center rounded-full bg-orange text-white shadow-[0_8px_20px_-8px_rgba(255,77,0,0.7)] transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-40"
            aria-label={playing ? "Пауза" : "Слушать"}
          >
            {playing ? (
              <Pause className="size-5" fill="currentColor" strokeWidth={0} />
            ) : (
              <Play className="ml-0.5 size-5" fill="currentColor" strokeWidth={0} />
            )}
          </button>
          <button
            type="button"
            onClick={() => skip(15)}
            disabled={!available}
            className="relative flex size-10 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-sunken hover:text-ink disabled:opacity-40"
            aria-label="Вперёд на 15 секунд"
            title="+15 секунд"
          >
            <RotateCw className="size-[18px]" strokeWidth={1.8} />
            <span className="absolute -bottom-0.5 text-[8px] font-medium">15</span>
          </button>
          {canEdit && recordingId ? (
            <button
              type="button"
              onClick={() => void addMark()}
              disabled={!available || markBusy}
              className="relative flex size-10 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-orange-tint hover:text-orange disabled:opacity-40"
              aria-label="Поставить метку на текущую фразу"
              title="Поставить метку на текущую фразу"
            >
              <BookmarkPlus className="size-[18px]" strokeWidth={1.8} />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2.5">
          <span className="hidden text-[10px] text-ink-300 sm:inline">Скорость</span>
          <select
            value={rate}
            onChange={(event) => setRate(Number(event.target.value))}
            disabled={!available}
            className="mono h-8 rounded-full border border-border-soft bg-card px-2.5 text-[10.5px] text-ink-500 outline-none transition-colors hover:border-ink-300 disabled:opacity-40"
            aria-label="Скорость воспроизведения"
          >
            {[0.75, 1, 1.25, 1.5, 2].map((value) => (
              <option key={value} value={value}>
                {value === 1 ? "1×" : `${String(value).replace(".", ",")}×`}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
