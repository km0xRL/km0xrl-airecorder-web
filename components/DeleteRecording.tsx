"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";

export function DeleteRecording({ recordingId }: { recordingId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/recordings/${recordingId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json()) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? "Не удалось удалить запись");
      }
      router.push("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить запись");
      setBusy(false);
    }
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] text-ink-300 transition-colors hover:bg-danger-tint hover:text-danger"
      >
        <Trash2 className="size-3.5" strokeWidth={1.8} />
        Удалить запись
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-danger/20 bg-danger-tint/60 p-3">
      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-danger">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
        Удалить запись и все ссылки? Это действие необратимо.
      </p>
      {error ? <p className="mt-2 text-[10.5px] text-danger">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={remove} disabled={busy} className="btn btn-danger btn-sm flex-1">
          {busy ? <RefreshCw className="size-3.5 animate-spin" strokeWidth={2} /> : null}
          Удалить
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="btn btn-outline btn-sm flex-1"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
