import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircleQuestion, Sparkles } from "lucide-react";
import { AskChat } from "@/components/AskChat";
import { askConfigured } from "@/lib/config";
import { getRecording } from "@/lib/recordings";

export const metadata: Metadata = { title: "Спросить архив" };
export const dynamic = "force-dynamic";

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ recording?: string }>;
}) {
  const params = await searchParams;
  const recordingId = (params.recording ?? "").trim();
  const recording = recordingId ? getRecording(recordingId) : null;
  if (recordingId && !recording) notFound();
  const configured = askConfigured();

  return (
    <div className="fade-up mx-auto w-full max-w-4xl">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-400 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.9} />
        Все записи
      </Link>

      <div className="mt-4 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-ink text-white">
          <MessageCircleQuestion className="size-5" strokeWidth={1.8} />
        </span>
        <div>
          <p className="mono text-[9px] uppercase tracking-[0.18em] text-ink-300">
            <Sparkles className="mr-1 inline size-2.5 text-orange" />
            LLM по архиву
          </p>
          <h1 className="mt-1 font-display text-[30px] font-medium leading-[1.02] tracking-[-0.035em] text-ink sm:text-[36px]">
            Спросить архив
          </h1>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-ink-400">
            Вопросы по расшифровкам и отчётам. Сайт сначала находит релевантные записи, затем отправляет
            только их фрагменты в LLM и показывает ссылки на источники.
          </p>
        </div>
      </div>

      <div className="mt-6">
        {configured ? (
          <AskChat
            recordingId={recording?.id}
            recordingTitle={recording?.title}
          />
        ) : (
          <div className="card-flat px-5 py-6">
            <h2 className="text-[14px] font-medium text-ink">LLM пока не подключён</h2>
            <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-ink-400">
              На сервере не заданы <span className="mono">TRANSCRIBE_BASE_URL</span> и{" "}
              <span className="mono">TRANSCRIBE_TOKEN</span> — адрес и токен сервиса, который умеет
              отвечать на вопросы. Ключ Claude API остаётся на сервисе и на сайте не хранится.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
