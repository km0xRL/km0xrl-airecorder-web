export function Footer({ note }: { note?: string }) {
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 pb-10 pt-8 text-[11px] text-ink-300 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <span className="font-mono uppercase tracking-[0.14em]">AI Recorder · km0xRL</span>
      <span>{note ?? "Записи остаются у вас. Ссылки защищены паролем."}</span>
    </footer>
  );
}
