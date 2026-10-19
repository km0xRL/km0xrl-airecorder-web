import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { isOwner, ownerSetupWarning } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Вход" };

const ERRORS: Record<string, string> = {
  wrong: "Неверный пароль. Попробуйте ещё раз.",
  slow: "Слишком много попыток. Подождите минуту.",
  config: "На сервере не задан пароль владельца.",
  origin: "Запрос пришёл с чужого адреса.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  if (await isOwner()) redirect("/");
  const params = await searchParams;
  const error = params.e ? ERRORS[params.e] ?? "Не удалось войти." : null;
  const warning = ownerSetupWarning();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 size-[420px] rounded-full bg-orange/20 blur-[100px]" aria-hidden="true" />
        <div className="relative">
          <Logo href={null} tone="light" />
        </div>

        <div className="relative my-10">
          <p className="mono text-[10px] uppercase tracking-[0.2em] text-white/40">единая база записей</p>
          <h1 className="mt-4 font-display text-[46px] font-medium leading-[0.96] tracking-[-0.045em]">
            Встречи звучат.
            <br />
            Текст остаётся.
          </h1>
          <p className="mt-5 max-w-md text-[14px] leading-relaxed text-white/55">
            Аудио, расшифровка с таймкодами и отчёт — в одном месте. Делитесь записью ссылкой с паролем,
            не отправляя файл.
          </p>

          <div className="relative mt-10 max-w-md rounded-2xl border border-white/10 bg-white/[0.055] p-5 backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="font-display text-[15px] font-medium">Планёрка по релизу</span>
              <span className="mono text-[9px] text-white/35">12:04</span>
            </div>
            <div className="mt-4 flex h-10 items-end gap-[3px]" aria-hidden="true">
              {[18, 34, 26, 48, 62, 40, 70, 52, 30, 44, 58, 36, 24, 50, 66, 42, 28, 38, 56, 32, 46, 60, 38, 26, 44, 54, 34, 48, 62, 40].map(
                (height, index) => (
                  <span
                    key={index}
                    className={`w-full rounded-full ${index < 19 ? "bg-orange" : "bg-white/20"}`}
                    style={{ height: `${height}%` }}
                  />
                ),
              )}
            </div>
            <div className="mt-4 space-y-2.5">
              <div className="flex gap-2.5">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-orange" />
                <p className="text-[12.5px] leading-snug text-white/70">
                  <span className="mr-1.5 font-mono text-[9px] text-white/30">00:42</span>
                  Релиз переносим на двадцатое, отчёт готов.
                </p>
              </div>
              <div className="flex gap-2.5">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-sky-400" />
                <p className="text-[12.5px] leading-snug text-white/70">
                  <span className="mr-1.5 font-mono text-[9px] text-white/30">01:08</span>
                  Тогда я соберу смету и задачи в ClickUp.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-[11px] text-white/30">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Railway · audio volume · private
        </div>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10 lg:px-16">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[390px]">
            <p className="mono text-[10px] uppercase tracking-[0.18em] text-ink-400">личный кабинет</p>
            <h2 className="mt-2 font-display text-[32px] font-medium tracking-[-0.04em] text-ink">Вход</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-400">
              Один владелец и один пароль. Получателям записей вход не нужен.
            </p>

            {warning ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-900">
                {warning}
              </div>
            ) : null}

            {error ? (
              <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-danger-tint px-4 py-3 text-[12.5px] text-danger">
                {error}
              </div>
            ) : null}

            <form action="/api/auth/login" method="post" className="mt-6 space-y-4">
              <div>
                <label htmlFor="password" className="label">
                  Пароль владельца
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoFocus
                  autoComplete="current-password"
                  className="input h-12"
                  placeholder="••••••••"
                />
              </div>
              <button type="submit" className="btn btn-primary h-12 w-full">
                Войти
              </button>
            </form>

            <p className="mt-6 text-[11px] leading-relaxed text-ink-300">
              Пароль задаётся переменной <span className="mono text-ink-400">OWNER_PASSWORD_HASH</span> на сервере.
              Ссылки для получателей живут отдельно и не открывают кабинет.
            </p>
          </div>
        </div>
        <p className="text-center text-[10px] text-ink-300 lg:text-left">AI Recorder · km0xRL</p>
      </main>
    </div>
  );
}
