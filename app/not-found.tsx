import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="mono mt-10 text-[10px] uppercase tracking-[0.2em] text-ink-300">404</p>
      <h1 className="mt-3 font-display text-3xl font-medium tracking-[-0.03em] text-ink">Страница не найдена</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-400">
        Возможно, ссылка устарела или запись удалили.
      </p>
      <Link href="/" className="btn btn-primary mt-6">
        К записям
      </Link>
    </div>
  );
}
