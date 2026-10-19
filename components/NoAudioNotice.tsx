import { VolumeX } from "lucide-react";

export function NoAudioNotice({ mode }: { mode: "owner" | "share" }) {
  return (
    <div className="card-flat flex items-start gap-3 px-4 py-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-400">
        <VolumeX className="size-4" strokeWidth={1.8} />
      </span>
      <div>
        <p className="text-[13px] font-medium text-ink">Аудио не загружено</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-400">
          {mode === "owner"
            ? "Текст и отчёт уже здесь. Приложение пришлёт аудио отдельным запросом — оно появится автоматически."
            : "Владелец поделился текстом и отчётом без аудио. Расшифровка и выводы доступны ниже."}
        </p>
      </div>
    </div>
  );
}
