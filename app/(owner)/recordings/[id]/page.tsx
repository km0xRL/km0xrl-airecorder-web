import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Cpu,
  Download,
  FileDown,
  HardDrive,
  Mic2,
  Share2,
  Smartphone,
} from "lucide-react";
import { DeleteRecording } from "@/components/DeleteRecording";
import { KindBadge } from "@/components/KindBadge";
import { RecordingBody } from "@/components/RecordingBody";
import { RecordingEditor } from "@/components/RecordingEditor";
import { ShareManager, type ShareItem } from "@/components/ShareManager";
import { TagChip } from "@/components/TagChip";
import { publicBaseUrl } from "@/lib/config";
import {
  formatBytes,
  formatDateRu,
  formatDateTimeRu,
  formatDuration,
  formatTimeRu,
  kindLabel,
} from "@/lib/format";
import { getRecording, listSharesForRecording, shareStatus } from "@/lib/recordings";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const recording = getRecording(id);
  return { title: recording?.title ?? "Запись" };
}

export default async function RecordingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recording = getRecording(id);
  if (!recording) notFound();

  const base = publicBaseUrl();
  const shares: ShareItem[] = listSharesForRecording(id).map((share) => ({
    id: share.id,
    token: share.token,
    label: share.label,
    status: shareStatus(share),
    createdAtMs: share.createdAtMs,
    expiresAtMs: share.expiresAtMs,
    lastAccessAtMs: share.lastAccessAtMs,
    accessCount: share.accessCount,
    url: `${base}/s/${share.token}`,
  }));

  const dateMs = recording.recordedAtMs ?? recording.createdAtMs;
  const audioUrl = recording.audio ? `/api/recordings/${id}/audio` : null;
  const pdfUrl = `/api/recordings/${id}/pdf`;

  return (
    <div className="fade-up">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-400 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.9} />
        Все записи
      </Link>

      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <KindBadge kind={recording.kind} />
          <span className="mono text-[10.5px] text-ink-400">{formatDateRu(dateMs)}</span>
          <span className="text-ink-200">·</span>
          <span className="mono text-[10.5px] text-ink-400">{formatTimeRu(dateMs)}</span>
          <span className="text-ink-200">·</span>
          <span className="mono text-[10.5px] text-ink-400">{formatDuration(recording.durationS)}</span>
          {recording.originDevice ? (
            <>
              <span className="text-ink-200">·</span>
              <span className="text-[10.5px] text-ink-400">{recording.originDevice}</span>
            </>
          ) : null}
        </div>

        <h1 className="mt-3 max-w-4xl font-display text-[30px] font-medium leading-[1.05] tracking-[-0.035em] text-ink sm:text-[38px]">
          {recording.title}
        </h1>

        {recording.tags.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {recording.tags.map((tag) => (
              <TagChip key={tag} tag={tag} className="chip-orange" />
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <a href="#share" className="btn btn-primary btn-sm">
            <Share2 className="size-3.5" strokeWidth={2} />
            Поделиться
          </a>
          <a href={pdfUrl} target="_blank" rel="noreferrer noopener" className="btn btn-outline btn-sm">
            <FileDown className="size-3.5" strokeWidth={1.9} />
            PDF
          </a>
          {audioUrl ? (
            <a href={`${audioUrl}?download=1`} className="btn btn-ghost btn-sm text-ink-400">
              <Download className="size-3.5" strokeWidth={1.9} />
              Скачать аудио
            </a>
          ) : null}
        </div>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0">
          <RecordingBody recording={recording} audioUrl={audioUrl} pdfUrl={pdfUrl} mode="owner" />
        </div>

        <aside className="space-y-3">
          <div className="card-flat overflow-hidden">
            <div className="border-b border-hairline px-4 py-3">
              <h2 className="text-[12.5px] font-medium text-ink">О записи</h2>
            </div>
            <dl className="divide-y divide-hairline px-4">
              <DetailRow icon={<CalendarDays className="size-3" strokeWidth={1.8} />} label="Дата">
                {formatDateTimeRu(dateMs)}
              </DetailRow>
              <DetailRow icon={<Clock3 className="size-3" strokeWidth={1.8} />} label="Длительность">
                {formatDuration(recording.durationS)}
              </DetailRow>
              <DetailRow icon={<Mic2 className="size-3" strokeWidth={1.8} />} label="Вид">
                {kindLabel(recording.kind)}
              </DetailRow>
              {recording.originDevice ? (
                <DetailRow icon={<Smartphone className="size-3" strokeWidth={1.8} />} label="Устройство">
                  {recording.originDevice}
                </DetailRow>
              ) : null}
              {recording.model ? (
                <DetailRow icon={<Cpu className="size-3" strokeWidth={1.8} />} label="Модель">
                  <span className="break-all">{recording.model}</span>
                </DetailRow>
              ) : null}
              <DetailRow icon={<HardDrive className="size-3" strokeWidth={1.8} />} label="Аудио">
                {recording.audio ? `${formatBytes(recording.audio.size)} · ${recording.audio.mime}` : "не загружено"}
              </DetailRow>
              <DetailRow icon={<Clock3 className="size-3" strokeWidth={1.8} />} label="Обновлено">
                {formatDateTimeRu(recording.updatedAtMs)}
              </DetailRow>
            </dl>
            {recording.sourceName ? (
              <div className="border-t border-hairline px-4 py-3">
                <p className="text-[9.5px] uppercase tracking-[0.1em] text-ink-300">Исходный файл</p>
                <p className="mono mt-1 break-all text-[10px] leading-relaxed text-ink-400">
                  {recording.sourceName}
                </p>
              </div>
            ) : null}
            <div className="border-t border-hairline px-4 py-3">
              <p className="text-[9.5px] uppercase tracking-[0.1em] text-ink-300">ID</p>
              <p className="mono mt-1 break-all text-[9.5px] leading-relaxed text-ink-300">
                {recording.clientId}
              </p>
            </div>
          </div>

          <ShareManager recordingId={recording.id} initialShares={shares} baseUrl={base} />
          <RecordingEditor
            recordingId={recording.id}
            initialTitle={recording.title}
            initialTags={recording.tags}
          />

          <div className="card-flat p-2">
            <DeleteRecording recordingId={recording.id} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt className="flex shrink-0 items-center gap-1.5 text-[10.5px] text-ink-300">
        {icon}
        {label}
      </dt>
      <dd className="text-right text-[10.5px] leading-relaxed text-ink-600">{children}</dd>
    </div>
  );
}
