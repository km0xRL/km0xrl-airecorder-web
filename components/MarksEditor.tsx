"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Highlighter, Trash2 } from "lucide-react";
import { formatDuration } from "@/lib/format";
import type { Mark } from "@/lib/types";

export function MarksEditor({
  recordingId,
  initialMarks,
}: {
  recordingId: string;
  initialMarks: Mark[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const marks = [...initialMarks].sort((a, b) => a.start - b.start);

  const remove = async (index: number) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/recordings/${recordingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marks: marks.filter((_, position) => position !== index) }),
      });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "Не удалось удалить метку");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить метку");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-flat overflow-hidden">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <Highlighter className="size-3.5 text-orange" strokeWidth={2} />
        <h2 className="text-[12.5px] font-medium text-ink">Метки</h2>
      </div>
      <div className="px-4 py-3.5">
        {marks.length ? (
          <ul className="space-y-1.5">
            {marks.map((mark, index) => (
              <li key={`${mark.start}-${mark.end}-${index}`} className="flex items-center justify-between gap-2">
                <span className="mono text-[10.5px] text-ink-500">
                  {formatDuration(mark.start)}
                  {mark.end - mark.start >= 0.05 ? ` — ${formatDuration(mark.end)}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => void remove(index)}
                  disabled={busy}
                  className="flex size-6 items-center justify-center rounded-full text-ink-300 transition-colors hover:bg-danger-tint hover:text-danger disabled:opacity-40"
                  aria-label="Удалить метку"
                  title="Удалить метку"
                >
                  <Trash2 className="size-3" strokeWidth={1.8} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[10.5px] leading-relaxed text-ink-300">
            Меток пока нет. Поставьте закладку в плеере — она привяжется к текущей фразе.
          </p>
        )}
        {error ? <p className="mt-2 text-[10.5px] text-danger">{error}</p> : null}
      </div>
    </div>
  );
}
