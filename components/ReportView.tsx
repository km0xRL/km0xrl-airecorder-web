"use client";

import { CheckSquare, CircleHelp, FileDown, Lightbulb, Quote, Sparkles } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { usePlayback } from "@/components/PlaybackProvider";
import { cn } from "@/lib/cn";
import type { Hint, MeetingReport } from "@/lib/types";

const HINT_LABELS: Record<string, string> = {
  task: "Задача",
  question: "Вопрос",
  decision: "Решение",
  no_decision: "Нет решения",
  balance: "Перекос речи",
};

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-hairline px-5 py-6 first:border-t-0 sm:px-7">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-[16px] font-medium tracking-[-0.01em] text-ink">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Hints({ hints, hasAudio }: { hints: Hint[]; hasAudio: boolean }) {
  const { seekTo } = usePlayback();
  if (!hints.length) return null;
  return (
    <Section
      title="Стоило спросить"
      aside={<span className="mono text-[10px] text-ink-300">{hints.length}</span>}
    >
      <div className="space-y-2.5">
        {hints.map((hint, index) => {
          const canSeek = hasAudio && hint.start != null;
          return (
            <div
              key={hint.key ?? index}
              className={cn(
                "relative rounded-xl border border-hairline bg-sunken/40 px-4 py-3",
                canSeek && "cursor-pointer transition-colors hover:border-orange/30 hover:bg-orange-tint/40",
              )}
              onClick={() => {
                if (canSeek && hint.start != null) seekTo(hint.start);
              }}
              role={canSeek ? "button" : undefined}
              tabIndex={canSeek ? 0 : undefined}
              onKeyDown={(event) => {
                if (!canSeek || hint.start == null) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  seekTo(hint.start);
                }
              }}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-orange-text">
                {hint.kind === "question" ? (
                  <CircleHelp className="size-3" strokeWidth={2} />
                ) : hint.kind === "decision" ? (
                  <Sparkles className="size-3" strokeWidth={2} />
                ) : (
                  <Lightbulb className="size-3" strokeWidth={2} />
                )}
                {HINT_LABELS[hint.kind ?? ""] ?? "Подсказка"}
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-700">{hint.text}</p>
              {hint.quote ? (
                <p className="mt-1.5 flex gap-1.5 text-[11.5px] leading-relaxed text-ink-400">
                  <Quote className="mt-0.5 size-3 shrink-0" strokeWidth={1.8} />
                  «{hint.quote}»
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function ReportView({
  report,
  hints,
  hasAudio,
  pdfUrl,
}: {
  report: MeetingReport | null;
  hints: Hint[];
  hasAudio: boolean;
  pdfUrl: string | null;
}) {
  if (!report && !hints.length) {
    return (
      <div className="card-flat flex flex-col items-center px-6 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-sunken text-ink-300">
          <FileDown className="size-5" strokeWidth={1.7} />
        </span>
        <p className="mt-4 font-display text-[17px] font-medium text-ink">Отчёта пока нет</p>
        <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-ink-400">
          Итоги, решения и задачи появятся здесь, когда приложение пришлёт отчёт.
        </p>
      </div>
    );
  }

  const hasStructured =
    Boolean(report?.summary.length) || Boolean(report?.decisions.length) || Boolean(report?.tasks.length);

  return (
    <div className="card-flat overflow-hidden">
      {pdfUrl ? (
        <div className="flex items-center justify-between gap-3 border-b border-hairline bg-sunken/30 px-5 py-2.5 sm:px-7">
          <span className="text-[11px] text-ink-400">Отчёт и расшифровка — в одном PDF</span>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-outline btn-sm"
          >
            <FileDown className="size-3.5" strokeWidth={1.9} />
            PDF
          </a>
        </div>
      ) : null}

      {report?.summary.length ? (
        <Section
          title="Итоги"
          aside={<span className="mono text-[10px] text-ink-300">{report.summary.length}</span>}
        >
          <ul className="space-y-2.5">
            {report.summary.map((item, index) => (
              <li key={index} className="flex gap-3 text-[13.5px] leading-[1.7] text-ink-700">
                <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-orange" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {report?.decisions.length ? (
        <Section
          title="Решения"
          aside={<span className="mono text-[10px] text-ink-300">{report.decisions.length}</span>}
        >
          <ol className="space-y-3">
            {report.decisions.map((item, index) => (
              <li key={index} className="flex gap-3 text-[13.5px] leading-[1.7] text-ink-700">
                <span className="mono mt-0.5 shrink-0 text-[10px] font-medium text-orange-text">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {report?.tasks.length ? (
        <Section
          title="Задачи"
          aside={<span className="mono text-[10px] text-ink-300">{report.tasks.length}</span>}
        >
          <ul className="space-y-2">
            {report.tasks.map((task, index) => (
              <li
                key={index}
                className="flex items-start gap-3 rounded-xl border border-hairline bg-card px-3.5 py-3"
              >
                <CheckSquare className="mt-0.5 size-4 shrink-0 text-ink-300" strokeWidth={1.7} />
                <div className="min-w-0">
                  <p className="text-[13px] leading-snug text-ink">{task.title}</p>
                  {task.assignee || task.due ? (
                    <p className="mt-1 text-[11px] text-ink-400">
                      {[task.assignee, task.due ? `до ${task.due}` : null].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {report?.markdown ? (
        <Section title={hasStructured ? "Протокол" : "Отчёт"}>
          <Markdown>{report.markdown}</Markdown>
        </Section>
      ) : null}

      {!hasStructured && !report?.markdown ? (
        <div className="px-5 py-10 text-center text-[12.5px] text-ink-400">
          Отчёт пуст.
        </div>
      ) : null}

      <Hints hints={hints} hasAudio={hasAudio} />
    </div>
  );
}
