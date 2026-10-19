import Link from "next/link";
import { ArrowUpRight, Clock3, HardDrive, Mic, Share2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { RecordingList } from "@/components/RecordingList";
import { formatBytes, formatDateRu, formatHoursTotal, plural } from "@/lib/format";
import { getStats, listRecordings } from "@/lib/recordings";
import type { RecordingKind } from "@/lib/types";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const FILTERS: { value: RecordingKind | null; label: string }[] = [
  { value: null, label: "Все" },
  { value: "meeting", label: "Встречи" },
  { value: "online_call", label: "Онлайн-звонки" },
  { value: "phone_call", label: "Звонки" },
];

function hrefFor(query: string, kind: RecordingKind | null): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (kind) params.set("kind", kind);
  const suffix = params.toString();
  return suffix ? `/?${suffix}` : "/";
}

export default async function RecordingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const kind: RecordingKind | null =
    params.kind === "meeting" || params.kind === "online_call" || params.kind === "phone_call"
      ? params.kind
      : null;

  const [recordings, stats] = [listRecordings({ query, kind }), getStats()];
  const hasAny = stats.recordings > 0;

  return (
    <div className="fade-up">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
            {formatDateRu(Date.now())}
          </p>
          <h1 className="mt-2 font-display text-[38px] font-medium leading-[0.95] tracking-[-0.04em] text-ink sm:text-[44px]">
            Записи
          </h1>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-400">
            Встречи и звонки из Android и Mac. Одна база: аудио, расшифровка, отчёт и теги.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Link href="/help" className="btn btn-ghost btn-sm text-ink-500">
            Как это работает
          </Link>
          <Link href="/settings" className="btn btn-outline">
            Подключить приложение
            <ArrowUpRight className="size-4" strokeWidth={1.8} />
          </Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          icon={<Mic className="size-3.5" strokeWidth={1.8} />}
          label="Записей"
          value={String(stats.recordings)}
          hint={stats.latestAtMs ? formatDateRu(stats.latestAtMs) : "пока пусто"}
        />
        <StatCard
          icon={<Clock3 className="size-3.5" strokeWidth={1.8} />}
          label="Общая длительность"
          value={formatHoursTotal(stats.durationS)}
          hint="за всё время"
        />
        <StatCard
          icon={<HardDrive className="size-3.5" strokeWidth={1.8} />}
          label="Аудио"
          value={formatBytes(stats.audioBytes)}
          hint={`${stats.audioRecordings} из ${stats.recordings} записей`}
        />
        <StatCard
          icon={<Share2 className="size-3.5" strokeWidth={1.8} />}
          label="Активных ссылок"
          value={String(stats.activeShares)}
          hint="с паролем"
        />
      </div>

      <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form action="/" method="get" className="relative w-full sm:max-w-sm">
          {kind ? <input type="hidden" name="kind" value={kind} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Название, тег, слово из расшифровки…"
            className="input h-11 pl-4 pr-4"
            aria-label="Поиск по записям"
          />
        </form>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((filter) => {
            const active = filter.value === kind;
            return (
              <Link
                key={filter.label}
                href={hrefFor(query, filter.value)}
                className={cn(
                  "rounded-full px-3.5 py-2 text-[12px] font-medium transition-colors",
                  active ? "bg-ink text-white" : "bg-card text-ink-500 ring-1 ring-hairline hover:text-ink",
                )}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        {recordings.length ? (
          <>
            {query ? (
              <p className="mb-4 px-1 text-[12px] text-ink-400">
                {recordings.length} {plural(recordings.length, "запись", "записи", "записей")} по запросу «{query}»
                {" · "}
                <Link href={hrefFor("", kind)} className="text-orange-text hover:underline">
                  сбросить
                </Link>
              </p>
            ) : null}
            <RecordingList recordings={recordings} />
          </>
        ) : hasAny ? (
          <EmptyState
            title="Ничего не нашлось"
            description={
              query
                ? `По запросу «${query}» нет записей. Поиск идёт по названию, тегам, расшифровке и отчёту.`
                : "В этом фильтре пока нет записей."
            }
          >
            <Link href="/" className="btn btn-outline">
              Показать все
            </Link>
          </EmptyState>
        ) : (
          <EmptyState
            title="Здесь появятся ваши записи"
            description="Отправьте запись из AI Recorder на Android или Mac — она окажется в этой базе вместе с расшифровкой и отчётом."
          >
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link href="/settings" className="btn btn-primary">
                Как подключить
                <ArrowUpRight className="size-4" strokeWidth={1.8} />
              </Link>
              <Link href="/help" className="btn btn-outline">
                Сценарий работы
              </Link>
            </div>
          </EmptyState>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="card-flat px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-ink-300">
        {icon}
        <span className="mono text-[9px] uppercase tracking-[0.12em]">{label}</span>
      </div>
      <p className="mt-2 font-display text-[22px] font-medium tracking-[-0.03em] text-ink">{value}</p>
      <p className="mt-0.5 truncate text-[10.5px] text-ink-300">{hint}</p>
    </div>
  );
}
