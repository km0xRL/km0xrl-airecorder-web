"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Users } from "lucide-react";

export function SpeakersEditor({
  recordingId,
  labels,
  initialNames,
}: {
  recordingId: string;
  labels: string[];
  initialNames: Record<string, string>;
}) {
  const router = useRouter();
  const [names, setNames] = useState<Record<string, string>>(initialNames);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNames(initialNames);
  }, [initialNames]);

  if (!labels.length) return null;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const speakerNames = Object.fromEntries(
        Object.entries(names)
          .map(([label, name]) => [label.trim(), name.trim()] as const)
          .filter(([label, name]) => label && name),
      );
      const response = await fetch(`/api/recordings/${recordingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speaker_names: speakerNames }),
      });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "Не удалось сохранить имена");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить имена");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-flat overflow-hidden">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <Users className="size-3.5 text-ink-400" strokeWidth={1.9} />
        <h2 className="text-[12.5px] font-medium text-ink">Говорящие</h2>
      </div>
      <form onSubmit={save} className="space-y-2.5 px-4 py-3.5">
        <p className="text-[10px] leading-relaxed text-ink-300">
          Имя применяется ко всем фразам этого говорящего. Отдельную фразу можно поправить карандашом в расшифровке.
        </p>
        {labels.map((label, index) => (
          <div key={label}>
            <label htmlFor={`speaker-${index}`} className="mb-1 flex items-center gap-1.5 text-[10px] text-ink-300">
              <span className="size-1.5 rounded-full bg-orange" />
              {label}
            </label>
            <input
              id={`speaker-${index}`}
              value={names[label] ?? ""}
              onChange={(event) => setNames((current) => ({ ...current, [label]: event.target.value }))}
              maxLength={200}
              placeholder={label}
              className="input h-8 text-[11.5px]"
            />
          </div>
        ))}
        {error ? <p className="text-[10.5px] text-danger">{error}</p> : null}
        <button type="submit" disabled={busy} className="btn btn-outline btn-sm w-full">
          {busy ? <RefreshCw className="size-3 animate-spin" strokeWidth={2} /> : null}
          Сохранить имена
        </button>
      </form>
    </div>
  );
}
