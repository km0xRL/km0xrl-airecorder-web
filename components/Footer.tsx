import Link from "next/link";

export function Footer({ note }: { note?: string }) {
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 pb-10 pt-8 text-[11px] text-ink-300 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <span className="font-mono uppercase tracking-[0.14em]">AI Recorder · km0xRL</span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href="/help" className="link-quiet underline decoration-hairline underline-offset-4">
          Как это работает
        </Link>
        <span>{note ?? "Записи остаются у вас. Ссылки защищены паролем."}</span>
      </span>
    </footer>
  );
}
