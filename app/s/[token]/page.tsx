import type { Metadata } from "next";
import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import { KindBadge } from "@/components/KindBadge";
import { Logo } from "@/components/Logo";
import { RecordingBody } from "@/components/RecordingBody";
import { TagChip } from "@/components/TagChip";
import { hasShareAccess } from "@/lib/auth";
import { formatDateRu, formatDuration, formatTimeRu } from "@/lib/format";
import { getRecording, getShareByToken, shareStatus } from "@/lib/recordings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Защищённая запись",
  robots: { index: false, follow: false, nocache: true },
};

const UNLOCK_ERRORS: Record<string, string> = {
  wrong: "Неверный пароль. Попробуйте ещё раз.",
  slow: "Слишком много попыток. Подождите минуту.",
  gone: "Ссылка больше не действует.",
};

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { token } = await params;
  const { e } = await searchParams;
  const share = getShareByToken(token);

  if (!share) return <Unavailable reason="unknown" />;
  if (shareStatus(share) === "expired") return <Unavailable reason="expired" />;
  if (shareStatus(share) === "revoked") return <Unavailable reason="revoked" />;

  const unlocked = await hasShareAccess(token, share.id);
  if (!unlocked) {
    return <UnlockScreen token={token} error={e ? UNLOCK_ERRORS[e] ?? null : null} />;
  }

  const recording = getRecording(share.recordingId);
  if (!recording) return <Unavailable reason="deleted" />;

  const dateMs = recording.recordedAtMs ?? recording.createdAtMs;
  const audioUrl = recording.audio ? `/api/share/${token}/audio` : null;
  const pdfUrl = `/api/share/${token}/pdf`;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-hairline bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo href={null} compact />
          <span className="chip chip-orange">
            <ShieldCheck className="size-3" strokeWidth={2} />
            защищено паролем
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
        <div className="fade-up">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <KindBadge kind={recording.kind} />
            <span className="mono text-[10.5px] text-ink-400">{formatDateRu(dateMs)}</span>
            <span className="text-ink-200">·</span>
            <span className="mono text-[10.5px] text-ink-400">{formatTimeRu(dateMs)}</span>
            <span className="text-ink-200">·</span>
            <span className="mono text-[10.5px] text-ink-400">{formatDuration(recording.durationS)}</span>
          </div>
          <h1 className="mt-3 font-display text-[30px] font-medium leading-[1.05] tracking-[-0.035em] text-ink sm:text-[40px]">
            {recording.title}
          </h1>
          {recording.tags.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {recording.tags.map((tag) => (
                <TagChip key={tag} tag={tag} className="chip-orange" />
              ))}
            </div>
          ) : null}

          <div className="mt-7">
            <RecordingBody recording={recording} audioUrl={audioUrl} pdfUrl={pdfUrl} mode="share" />
          </div>
        </div>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-1.5 px-4 py-6 text-[10.5px] text-ink-300 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="font-mono uppercase tracking-[0.14em]">AI Recorder · km0xRL</span>
          <span>Запись сделана в AI Recorder. Ссылка открывает только эту запись.</span>
        </div>
      </footer>
    </div>
  );
}

function UnlockScreen({ token, error }: { token: string; error: string | null }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center px-4 sm:px-6">
          <Logo href={null} compact />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-ink text-white">
            <Lock className="size-5" strokeWidth={1.8} />
          </span>
          <h1 className="mt-5 font-display text-[30px] font-medium leading-tight tracking-[-0.035em] text-ink">
            Защищённая запись
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-400">
            Введите пароль, который прислал владелец. Он открывает только эту запись.
          </p>

          {error ? (
            <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-danger-tint px-4 py-3 text-[12.5px] text-danger">
              {error}
            </div>
          ) : null}

          <form action={`/api/share/${token}/unlock`} method="post" className="mt-6 space-y-4">
            <div>
              <label htmlFor="password" className="label">
                Пароль
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-300" strokeWidth={1.7} />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoFocus
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="input h-12 pl-10"
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary h-12 w-full">
              Открыть запись
            </button>
          </form>

          <p className="mt-6 text-[11px] leading-relaxed text-ink-300">
            Если пароль не подходит, попросите у отправителя новую ссылку. Пароль не показывается на сайте.
          </p>
        </div>
      </main>
      <footer className="pb-8 text-center text-[10px] text-ink-300">AI Recorder · km0xRL</footer>
    </div>
  );
}

const UNAVAILABLE_TEXT: Record<string, { title: string; text: string }> = {
  expired: {
    title: "Срок ссылки истёк",
    text: "Попросите у отправителя новую ссылку с паролем.",
  },
  revoked: {
    title: "Ссылка отозвана",
    text: "Владелец закрыл доступ по этой ссылке. Попросите новую.",
  },
  deleted: {
    title: "Запись удалена",
    text: "Владелец удалил запись, поэтому ссылка больше не открывается.",
  },
  unknown: {
    title: "Ссылка недействительна",
    text: "Проверьте, что ссылка скопирована целиком, или попросите новую у отправителя.",
  },
};

function Unavailable({ reason }: { reason: keyof typeof UNAVAILABLE_TEXT }) {
  const info = UNAVAILABLE_TEXT[reason] ?? UNAVAILABLE_TEXT.unknown!;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center px-4 sm:px-6">
          <Logo href={null} compact />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px] text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-sunken text-ink-400">
            <Lock className="size-5" strokeWidth={1.8} />
          </span>
          <h1 className="mt-5 font-display text-[26px] font-medium tracking-[-0.03em] text-ink">{info.title}</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-400">{info.text}</p>
        </div>
      </main>
      <footer className="pb-8 text-center text-[10px] text-ink-300">AI Recorder · km0xRL</footer>
    </div>
  );
}
