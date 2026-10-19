"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="mono mt-10 text-[10px] uppercase tracking-[0.2em] text-ink-300">ошибка</p>
      <h1 className="mt-3 font-display text-3xl font-medium tracking-[-0.03em] text-ink">
        Что-то пошло не так
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-400">
        Запись не потерялась. Попробуйте обновить страницу — если не поможет, вернитесь к списку.
      </p>
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={reset} className="btn btn-primary">
          Повторить
        </button>
        <Link href="/" className="btn btn-outline">
          К записям
        </Link>
      </div>
    </div>
  );
}
