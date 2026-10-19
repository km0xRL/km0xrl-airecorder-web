import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import {
  CheckCircle2,
  Database,
  HardDrive,
  KeyRound,
  Server,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { config, ingestConfigured, ownerCredentialsConfigured, publicBaseUrl } from "@/lib/config";
import { formatBytes, formatHoursTotal } from "@/lib/format";
import { getStats } from "@/lib/recordings";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Настройки" };

function StatusRow({
  ok,
  label,
  value,
  hint,
}: {
  ok: boolean;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex min-w-0 items-start gap-2">
        {ok ? (
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" strokeWidth={2} />
        ) : (
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" strokeWidth={2} />
        )}
        <div className="min-w-0">
          <p className="text-[11.5px] font-medium text-ink">{label}</p>
          {hint ? <p className="mt-0.5 text-[10px] leading-relaxed text-ink-300">{hint}</p> : null}
        </div>
      </div>
      <span className="mono max-w-[55%] shrink-0 break-all text-right text-[10px] text-ink-400">{value}</span>
    </div>
  );
}

export default async function SettingsPage() {
  const stats = getStats();
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = publicBaseUrl() || `${proto}://${host}`;
  const token = process.env.INGEST_TOKEN?.trim() ?? "";
  const maskedToken = token ? `••••••••••${token.slice(-4)}` : "не задан";
  const base = origin.replace(/\/+$/, "");

  const warnings = [
    !ownerCredentialsConfigured() && "Не задан пароль владельца — вход невозможен.",
    !ingestConfigured() && "Не задан INGEST_TOKEN — приложения не смогут отправлять записи.",
    !process.env.SESSION_SECRET && "Не задан SESSION_SECRET — вход и ссылки не будут работать.",
    !publicBaseUrl() && "PUBLIC_BASE_URL не задан — ссылки строятся из адреса запроса.",
    config.isProduction && !process.env.OWNER_PASSWORD_HASH && "На сервере задан пароль в открытом виде — лучше OWNER_PASSWORD_HASH.",
    config.isProduction && !config.dataDir.startsWith("/data") && "На Railway том обычно монтируется в /data — проверьте DATA_DIR.",
  ].filter(Boolean) as string[];

  return (
    <div className="fade-up">
      <p className="mono text-[10px] uppercase tracking-[0.18em] text-ink-400">служебное</p>
      <h1 className="mt-2 font-display text-[36px] font-medium tracking-[-0.04em] text-ink sm:text-[42px]">Настройки</h1>
      <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-ink-400">
        Один владелец, одна база. Здесь — состояние хранилища и адрес, на который приложения присылают записи.
      </p>

      {warnings.length ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-amber-900">
            <TriangleAlert className="size-3.5" strokeWidth={2} />
            Требует внимания
          </p>
          <ul className="mt-2 space-y-1">
            {warnings.map((warning) => (
              <li key={warning} className="text-[11.5px] leading-relaxed text-amber-900/80">
                · {warning}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11.5px] text-emerald-800">
          <ShieldCheck className="size-4" strokeWidth={2} />
          Всё настроено: пароль владельца, токен приёма и публичный адрес.
        </div>
      )}

      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-hairline px-5 py-3.5">
            <KeyRound className="size-4 text-ink-400" strokeWidth={1.8} />
            <h2 className="text-[13px] font-medium text-ink">Доступ</h2>
          </div>
          <div className="divide-y divide-hairline px-5">
            <StatusRow
              ok={ownerCredentialsConfigured()}
              label="Пароль владельца"
              value={process.env.OWNER_PASSWORD_HASH ? "хеш задан" : "открытый пароль"}
              hint="Один вход для кабинета. Получатели ссылок входят по паролю ссылки."
            />
            <StatusRow
              ok={Boolean(process.env.SESSION_SECRET)}
              label="Секрет сессий"
              value={process.env.SESSION_SECRET ? "задан" : "не задан"}
              hint="Подписывает cookie владельца и получателей."
            />
            <StatusRow
              ok={Boolean(process.env.OWNER_PASSWORD_HASH)}
              label="Хранение пароля"
              value={process.env.OWNER_PASSWORD_HASH ? "scrypt" : "переменная окружения"}
              hint="Для сервера рекомендуем OWNER_PASSWORD_HASH."
            />
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-hairline px-5 py-3.5">
            <Server className="size-4 text-ink-400" strokeWidth={1.8} />
            <h2 className="text-[13px] font-medium text-ink">Приём из Android и Mac</h2>
          </div>
          <div className="space-y-3 px-5 py-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-ink-300">Базовый адрес</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <code className="mono min-w-0 flex-1 truncate rounded-lg bg-sunken px-2.5 py-2 text-[10px] text-ink-600">
                  {base}
                </code>
                <CopyButton value={base} label="Адрес" iconOnly />
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-ink-300">Токен приёма</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <code className="mono min-w-0 flex-1 truncate rounded-lg bg-sunken px-2.5 py-2 text-[10px] text-ink-600">
                  {maskedToken}
                </code>
                <a
                  href="/api/v1/health"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn btn-outline btn-sm shrink-0"
                >
                  Проверить
                </a>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-ink-300">
                Заголовок <span className="mono">Authorization: Bearer &lt;INGEST_TOKEN&gt;</span>. Токен меняется в
                переменных окружения, в интерфейсе он не показывается.
              </p>
            </div>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-hairline px-5 py-3.5">
            <HardDrive className="size-4 text-ink-400" strokeWidth={1.8} />
            <h2 className="text-[13px] font-medium text-ink">Хранилище</h2>
          </div>
          <div className="grid grid-cols-2 divide-x divide-hairline">
            <div className="px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.1em] text-ink-300">Записей</p>
              <p className="mt-1 font-display text-[22px] font-medium text-ink">{stats.recordings}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.1em] text-ink-300">Длительность</p>
              <p className="mt-1 font-display text-[22px] font-medium text-ink">{formatHoursTotal(stats.durationS)}</p>
            </div>
          </div>
          <div className="divide-y divide-hairline border-t border-hairline px-5">
            <StatusRow ok label="Аудио на томе" value={formatBytes(stats.audioBytes)} hint={config.dataDir} />
            <StatusRow
              ok
              label="Лимит файла"
              value={`${Math.round(config.maxAudioBytes / 1024 / 1024)} МБ`}
              hint="MAX_AUDIO_BYTES"
            />
            <StatusRow ok={stats.activeShares > 0} label="Активных ссылок" value={String(stats.activeShares)} />
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-hairline px-5 py-3.5">
            <Database className="size-4 text-ink-400" strokeWidth={1.8} />
            <h2 className="text-[13px] font-medium text-ink">Как это работает</h2>
          </div>
          <ol className="space-y-3 px-5 py-4 text-[11.5px] leading-relaxed text-ink-500">
            <li className="flex gap-2.5">
              <span className="mono mt-0.5 text-[10px] text-orange-text">01</span>
              Приложение отправляет метаданные: название, текст, отчёт, теги и говорящих.
            </li>
            <li className="flex gap-2.5">
              <span className="mono mt-0.5 text-[10px] text-orange-text">02</span>
              Затем — сам аудиофайл. Сайт хранит его на Railway volume и отдаёт с поддержкой Range.
            </li>
            <li className="flex gap-2.5">
              <span className="mono mt-0.5 text-[10px] text-orange-text">03</span>
              Для получателя создаётся ссылка с паролем. Она открывает только одну запись.
            </li>
            <li className="flex gap-2.5">
              <span className="mono mt-0.5 text-[10px] text-orange-text">04</span>
              Пароль ссылки не хранится в открытом виде: только scrypt-хеш. Показать пароль повторно нельзя.
            </li>
          </ol>
        </section>
      </div>

      <section className="card-flat mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[12.5px] font-medium text-ink">Как проходит запись — от телефона до ссылки</p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
            Семь шагов, что видит получатель и как работает синхронизация.
          </p>
        </div>
        <Link href="/help" className="btn btn-outline btn-sm shrink-0">
          Открыть сценарий
        </Link>
      </section>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Server className="size-4 text-ink-400" strokeWidth={1.8} />
            <h2 className="text-[13px] font-medium text-ink">Контракт API</h2>
          </div>
          <span className="mono text-[9px] uppercase tracking-[0.1em] text-ink-300">v1</span>
        </div>
        <div className="space-y-4 px-5 py-4">
          <Endpoint
            method="PUT"
            path="/api/v1/recordings/{client_id}"
            description="Создать или обновить запись. JSON, до 6 МБ."
          />
          <Endpoint
            method="PUT"
            path="/api/v1/recordings/{client_id}/audio"
            description="Загрузить аудио потоком. Content-Type — audio/*, необязательный X-Sha256."
          />
          <Endpoint
            method="GET"
            path="/api/v1/recordings/{client_id}"
            description="Забрать запись в формате библиотеки — для восстановления на другом устройстве."
          />
          <Endpoint
            method="GET"
            path="/api/v1/recordings?since=0&limit=100"
            description="Изменения после since (мс эпохи) — для синхронизации."
          />
          <Endpoint
            method="DELETE"
            path="/api/v1/recordings/{client_id}"
            description="Удалить запись и её аудио (мягкое удаление)."
          />

          <div className="rounded-xl bg-ink px-4 py-4 text-white/80">
            <p className="mono text-[9px] uppercase tracking-[0.14em] text-white/35">пример</p>
            <pre className="mono mt-2 overflow-x-auto text-[10px] leading-relaxed">
{`BASE=${base}
TOKEN=<INGEST_TOKEN>

curl -X PUT "$BASE/api/v1/recordings/rec_demo_001" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  --data @recording.json

curl -X PUT "$BASE/api/v1/recordings/rec_demo_001/audio?name=meeting.m4a" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: audio/mp4" \\
  --data-binary @meeting.m4a`}
            </pre>
          </div>
          <p className="text-[10.5px] leading-relaxed text-ink-300">
            Полный контракт — в <span className="mono">docs/API.md</span>. Поля совместимы с документом
            библиотеки приложения: <span className="mono">source_name, kind, transcript, report, speaker_names, tags</span>.
            Теги лучше присылать названиями, а не id каталога.
          </p>
        </div>
      </section>
    </div>
  );
}

function Endpoint({
  method,
  path,
  description,
}: {
  method: string;
  path: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-hairline pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-3">
      <span
        className={cn(
          "mono w-fit shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.06em]",
          method === "PUT" ? "bg-orange-tint text-orange-text" : method === "DELETE" ? "bg-danger-tint text-danger" : "bg-sunken text-ink-500",
        )}
      >
        {method}
      </span>
      <div className="min-w-0">
        <code className="mono break-all text-[10.5px] text-ink-700">{path}</code>
        <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-400">{description}</p>
      </div>
    </div>
  );
}
