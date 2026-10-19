"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, RefreshCw, X } from "lucide-react";

export function RecordingEditor({
  recordingId,
  initialTitle,
  initialTags,
}: {
  recordingId: string;
  initialTitle: string;
  initialTags: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [tags, setTags] = useState(initialTags.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/recordings/${recordingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          tags: tags
            .split(",")
            .map((tag) => tag.replace(/^#/, "").trim())
            .filter(Boolean)
            .slice(0, 50),
        }),
      });
      const data = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "Не удалось сохранить");
      setEditing(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-flat overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <h2 className="text-[12.5px] font-medium text-ink">Название и теги</h2>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-[10.5px] text-ink-400 transition-colors hover:text-ink"
          >
            <Pencil className="size-3" strokeWidth={1.9} />
            Изменить
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setTitle(initialTitle);
              setTags(initialTags.join(", "));
              setError(null);
            }}
            className="flex items-center gap-1 text-[10.5px] text-ink-400 transition-colors hover:text-ink"
          >
            <X className="size-3" strokeWidth={2} />
            Отмена
          </button>
        )}
      </div>
      {editing ? (
        <form onSubmit={save} className="space-y-3 px-4 py-4">
          <div>
            <label htmlFor="rec-title" className="label">
              Название
            </label>
            <input
              id="rec-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={300}
              className="input h-9 text-[12px]"
              required
            />
          </div>
          <div>
            <label htmlFor="rec-tags" className="label">
              Теги через запятую
            </label>
            <input
              id="rec-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              className="input h-9 text-[12px]"
              placeholder="релиз, команда"
            />
          </div>
          {error ? <p className="text-[11px] text-danger">{error}</p> : null}
          <button type="submit" disabled={busy} className="btn btn-primary btn-sm w-full">
            {busy ? <RefreshCw className="size-3.5 animate-spin" strokeWidth={2} /> : null}
            Сохранить
          </button>
        </form>
      ) : (
        <div className="px-4 py-3.5">
          <p className="text-[12px] leading-snug text-ink">{initialTitle}</p>
          <p className="mt-1 text-[10.5px] text-ink-300">
            {initialTags.length ? initialTags.map((tag) => `#${tag}`).join("  ") : "Без тегов"}
          </p>
        </div>
      )}
    </div>
  );
}
