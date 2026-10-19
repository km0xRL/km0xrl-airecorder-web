"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, MessageCircleQuestion, RotateCcw, Send, Sparkles } from "lucide-react";
import { formatDateRu } from "@/lib/format";

interface Source {
  id: string;
  title: string;
  recordedAtMs: number | null;
}

interface Message {
  role: "user" | "assistant";
  text: string;
  sources?: Source[];
}

interface AnswerResponse {
  text?: string;
  sources?: Source[];
  error?: { message?: string };
}

const GLOBAL_EXAMPLES = [
  "Что решили по последнему релизу?",
  "Какие задачи остались открытыми?",
  "Что говорили про инфраструктуру?",
];

const RECORDING_EXAMPLES = [
  "О чём эта запись?",
  "Какие решения приняли?",
  "Какие задачи и сроки обсуждали?",
];

export function AskChat({
  recordingId,
  recordingTitle,
}: {
  recordingId?: string;
  recordingTitle?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const examples = recordingId ? RECORDING_EXAMPLES : GLOBAL_EXAMPLES;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const ask = async (text: string) => {
    const value = text.trim();
    if (!value || busy) return;
    const history = messages.slice(-6).map((message) => ({
      role: message.role,
      content: message.text,
    }));
    const before = messages;
    setMessages([...messages, { role: "user", text: value }]);
    setQuestion("");
    setBusy(true);
    setError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: value, history, recordingId: recordingId ?? undefined }),
        signal: controller.signal,
      });
      const data = (await response.json()) as AnswerResponse;
      if (!response.ok || !data.text) {
        throw new Error(data.error?.message ?? "Не удалось получить ответ");
      }
      setMessages((current) => [
        ...current,
        { role: "assistant", text: data.text!, sources: data.sources ?? [] },
      ]);
    } catch (cause) {
      setMessages(before);
      setQuestion(value);
      const message =
        cause instanceof DOMException && cause.name === "AbortError"
          ? "LLM не ответил за 90 секунд — попробуйте ещё раз"
          : cause instanceof Error
            ? cause.message
            : "Не удалось получить ответ";
      setError(message);
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-hairline bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-[11.5px] text-ink-500">
          <Sparkles className="size-3.5 text-orange" strokeWidth={1.9} />
          {recordingId ? (
            <span>
              По записи: <span className="text-ink">{recordingTitle ?? "без названия"}</span>
            </span>
          ) : (
            <span>По всему архиву: сначала ищу релевантные записи, потом спрашиваю LLM</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {recordingId ? (
            <Link href="/ask" className="text-[10.5px] text-ink-400 underline decoration-hairline underline-offset-4 hover:text-ink">
              Весь архив
            </Link>
          ) : null}
          {messages.length ? (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setError(null);
                setQuestion("");
              }}
              className="flex items-center gap-1 text-[10.5px] text-ink-400 transition-colors hover:text-ink"
            >
              <RotateCcw className="size-3" strokeWidth={1.9} />
              Новый разговор
            </button>
          ) : null}
        </div>
      </div>

      {!messages.length && !busy ? (
        <div className="card-flat px-5 py-6">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-tint text-orange">
              <MessageCircleQuestion className="size-4" strokeWidth={1.9} />
            </span>
            <div>
              <h2 className="text-[14px] font-medium text-ink">Спросите свои записи</h2>
              <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-ink-400">
                Например: что решили, какие задачи поставили, что говорили по теме. Модель получает только
                фрагменты релевантных записей и обязана ссылаться на них.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => void ask(example)}
                className="rounded-full border border-hairline bg-canvas px-3 py-1.5 text-left text-[11px] text-ink-500 transition-colors hover:border-ink-300 hover:text-ink"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3" aria-live="polite">
        {messages.map((message, index) =>
          message.role === "user" ? (
            <div key={index} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[13px] leading-relaxed text-white">
                {message.text}
              </div>
            </div>
          ) : (
            <div key={index} className="card-flat px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-ink-300">
                <Sparkles className="size-3 text-orange" strokeWidth={2} />
                LLM
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-[1.7] text-ink-700">
                {message.text}
              </p>
              {message.sources?.length ? (
                <div className="mt-3 border-t border-hairline pt-2.5">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-ink-300">Источники</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {message.sources.map((source) => (
                      <Link
                        key={source.id}
                        href={`/recordings/${source.id}`}
                        className="flex max-w-full items-center gap-1 rounded-full bg-sunken px-2.5 py-1 text-[10.5px] text-ink-500 transition-colors hover:bg-orange-tint hover:text-orange-text"
                      >
                        <span className="truncate">{source.title}</span>
                        {source.recordedAtMs ? (
                          <span className="mono shrink-0 text-[9.5px] text-ink-300">
                            {formatDateRu(source.recordedAtMs)}
                          </span>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 border-t border-hairline pt-2 text-[10px] text-ink-300">
                  Модель не указала запись-источник — проверьте ответ по расшифровкам.
                </p>
              )}
            </div>
          ),
        )}

        {busy ? (
          <div className="card-flat flex items-center gap-2.5 px-4 py-3.5 text-[11.5px] text-ink-400">
            <Loader2 className="size-3.5 animate-spin text-orange" strokeWidth={2} />
            Ищу в записях и спрашиваю модель…
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-danger/20 bg-danger-tint px-4 py-3 text-[11.5px] leading-relaxed text-danger">
          {error}
        </div>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
        className="card-flat p-2.5"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void ask(question);
              }
            }}
            rows={2}
            maxLength={2000}
            disabled={busy}
            placeholder={recordingId ? "Спросите об этой записи…" : "Спросите по всем записям…"}
            className="min-h-[52px] flex-1 resize-none bg-transparent px-2 py-1 text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink-300 disabled:opacity-50"
            aria-label="Вопрос к LLM"
          />
          <button
            type="submit"
            disabled={busy || !question.trim()}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange text-white transition-opacity hover:opacity-90 disabled:opacity-35"
            aria-label="Спросить"
            title="Спросить"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            ) : (
              <Send className="size-4" strokeWidth={2} />
            )}
          </button>
        </div>
        <p className="px-2 pb-0.5 text-[9px] leading-relaxed text-ink-300">
          LLM получает только фрагменты выбранных записей. Ответы могут быть неполными — сверяйтесь с источниками.
          Enter — отправить, Shift+Enter — новая строка.
        </p>
      </form>
      <div ref={bottomRef} />
    </div>
  );
}
