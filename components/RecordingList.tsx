import Link from "next/link";
import { ClipboardCheck, FileText, Play, Share2 } from "lucide-react";
import { KindBadge } from "@/components/KindBadge";
import { TagChip } from "@/components/TagChip";
import {
  dayKey,
  formatDateRu,
  formatDayHeading,
  formatDuration,
  formatTimeRu,
  plural,
} from "@/lib/format";
import type { RecordingSummary } from "@/lib/types";

function StatusIcons({ item }: { item: RecordingSummary }) {
  return (
    <span className="flex items-center gap-1.5 text-ink-300">
      {item.hasAudio ? (
        <span title="Есть аудио" aria-label="Есть аудио">
          <Play className="size-3.5" strokeWidth={1.8} />
        </span>
      ) : null}
      {item.hasTranscript ? (
        <span title="Есть расшифровка" aria-label="Есть расшифровка">
          <FileText className="size-3.5" strokeWidth={1.8} />
        </span>
      ) : null}
      {item.hasReport ? (
        <span title="Есть отчёт" aria-label="Есть отчёт">
          <ClipboardCheck className="size-3.5" strokeWidth={1.8} />
        </span>
      ) : null}
      {item.shareCount > 0 ? (
        <span className="flex items-center gap-0.5" title={`${item.shareCount} ссылок`}>
          <Share2 className="size-3.5" strokeWidth={1.8} />
          <span className="mono text-[10px]">{item.shareCount}</span>
        </span>
      ) : null}
    </span>
  );
}

function RecordingRow({
  item,
  first,
  showDate = false,
}: {
  item: RecordingSummary;
  first: boolean;
  showDate?: boolean;
}) {
  const dateMs = item.recordedAtMs ?? item.updatedAtMs;
  return (
    <Link
      href={`/recordings/${item.id}`}
      className={`group flex items-center gap-2.5 px-3.5 py-3.5 transition-colors hover:bg-sunken/60 sm:gap-4 sm:px-5 ${
        first ? "" : "border-t border-hairline"
      }`}
    >
      <span className="mono hidden w-[42px] shrink-0 text-[11px] text-ink-300 sm:block">
        {item.recordedAtMs ? formatTimeRu(item.recordedAtMs) : "—"}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-medium leading-snug text-ink group-hover:text-orange-text sm:text-[14.5px]">
            {item.title}
          </span>
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {showDate ? (
            <span className="mono text-[10px] text-ink-300">{formatDateRu(dateMs)}</span>
          ) : null}
          <KindBadge kind={item.kind} className="hidden sm:inline-flex" />
          {item.tags.slice(0, 3).map((tag) => (
            <TagChip key={tag} tag={tag} className="hidden sm:inline-flex" />
          ))}
          <span className="mono text-[10px] text-ink-300 sm:hidden">
            {item.recordedAtMs ? formatTimeRu(item.recordedAtMs) : "—"}
          </span>
          {item.originDevice ? (
            <span className="hidden truncate text-[11px] text-ink-300 md:inline">
              {item.originDevice}
            </span>
          ) : null}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2.5 sm:gap-3">
        <span className="hidden sm:flex"><StatusIcons item={item} /></span>
        <span className="mono w-[40px] text-right text-[10.5px] text-ink-400 sm:w-[44px] sm:text-[11px]">
          {formatDuration(item.durationS)}
        </span>
      </span>
    </Link>
  );
}

export function RecordingList({
  recordings,
  grouped = true,
}: {
  recordings: RecordingSummary[];
  grouped?: boolean;
}) {
  if (!recordings.length) return null;

  if (!grouped) {
    return (
      <div className="card overflow-hidden">
        {recordings.map((item, index) => (
          <RecordingRow key={item.id} item={item} first={index === 0} showDate />
        ))}
      </div>
    );
  }

  const groups = new Map<string, RecordingSummary[]>();
  for (const item of recordings) {
    const key = dayKey(item.recordedAtMs ?? item.updatedAtMs);
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }

  return (
    <div className="space-y-8">
      {[...groups.entries()].map(([key, items]) => {
        const heading = formatDayHeading(items[0]!.recordedAtMs ?? items[0]!.updatedAtMs);
        return (
          <section key={key} aria-labelledby={`day-${key}`}>
            <div className="mb-2.5 flex items-baseline justify-between px-1">
              <h2 id={`day-${key}`} className="font-display text-[15px] font-medium tracking-[-0.01em] text-ink">
                {heading}
              </h2>
              <span className="mono text-[10px] uppercase tracking-[0.12em] text-ink-300">
                {items.length} {plural(items.length, "запись", "записи", "записей")}
              </span>
            </div>
            <div className="card overflow-hidden">
              {items.map((item, index) => (
                <RecordingRow key={item.id} item={item} first={index === 0} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
