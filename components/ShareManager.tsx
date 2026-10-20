"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Eye,
  KeyRound,
  Link2,
  Plus,
  RefreshCw,
  Share2,
  ShieldCheck,
  Undo2,
  Ban,
} from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { formatDateRu, formatDateTimeRu, plural } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ShareStatus } from "@/lib/types";

export interface ShareItem {
  id: string;
  token: string;
  label: string | null;
  status: ShareStatus;
  createdAtMs: number;
  expiresAtMs: number | null;
  lastAccessAtMs: number | null;
  accessCount: number;
  url: string;
}

interface ApiShare {
  id: string;
  token: string;
  label: string | null;
  createdAtMs: number;
  expiresAtMs: number | null;
  revokedAtMs: number | null;
  lastAccessAtMs: number | null;
  accessCount: number;
  url: string;
  status: ShareStatus;
}

const STATUS_LABEL: Record<ShareStatus, string> = {
  active: "активна",
  expired: "истекла",
  revoked: "отозвана",
};

const STATUS_COLOR: Record<ShareStatus, string> = {
  active: "bg-success",
  expired: "bg-ink-300",
  revoked: "bg-danger",
};

function statusOf(share: { revokedAtMs: number | null; expiresAtMs: number | null }): ShareStatus {
  if (share.revokedAtMs) return "revoked";
  if (share.expiresAtMs != null && share.expiresAtMs <= Date.now()) return "expired";
  return "active";
}

function toItem(share: ApiShare): ShareItem {
  return {
    id: share.id,
    token: share.token,
    label: share.label,
    status: share.revokedAtMs ? "revoked" : statusOf(share),
    createdAtMs: share.createdAtMs,
    expiresAtMs: share.expiresAtMs,
    lastAccessAtMs: share.lastAccessAtMs,
    accessCount: share.accessCount,
    url: share.url,
  };
}

export function ShareManager({
  recordingId,
  initialShares,
  baseUrl,
  recordingTitle,
}: {
  recordingId: string;
  initialShares: ShareItem[];
  baseUrl: string;
  recordingTitle: string;
}) {
  const [shares, setShares] = useState<ShareItem[]>(initialShares);
  const [origin, setOrigin] = useState(baseUrl);
  const [label, setLabel] = useState("");
  const [password, setPassword] = useState("");
  const [expiry, setExpiry] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ url: string; password: string; label: string | null; expiresAtMs: number | null } | null>(null);

  useEffect(() => {
    if (!baseUrl) setOrigin(window.location.origin);
  }, [baseUrl]);

  const resolvedOrigin = origin.replace(/\/+$/, "");

  const displayUrl = (url: string) => {
    if (url.startsWith("http")) return url;
    return `${resolvedOrigin}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/recordings/${recordingId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || null,
          password: password.trim() || undefined,
          expiresInDays: expiry === "never" ? null : Number(expiry),
        }),
      });
      const data = (await response.json()) as {
        share?: ApiShare;
        password?: string;
        url?: string;
        error?: { message?: string };
      };
      if (!response.ok || !data.share || !data.password || !data.url) {
        throw new Error(data.error?.message ?? "Не удалось создать ссылку");
      }
      const item = toItem({ ...data.share, url: data.url, status: "active" });
      setShares((current) => [item, ...current]);
      setCreated({
        url: displayUrl(data.url),
        password: data.password,
        label: data.share.label,
        expiresAtMs: data.share.expiresAtMs,
      });
      setLabel("");
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось создать ссылку");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/shares/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { share?: ApiShare; error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "Не удалось отозвать ссылку");
      setShares((current) =>
        current.map((share) => (share.id === id ? { ...share, status: "revoked" } : share)),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось отозвать ссылку");
    } finally {
      setBusy(false);
    }
  };

  const restore = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/shares/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });
      const data = (await response.json()) as { share?: ApiShare; error?: { message?: string } };
      if (!response.ok || !data.share) throw new Error(data.error?.message ?? "Не удалось вернуть ссылку");
      setShares((current) =>
        current.map((share) => (share.id === id ? { ...share, status: statusOf(data.share!) } : share)),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось вернуть ссылку");
    } finally {
      setBusy(false);
    }
  };

  const rotate = async (share: ShareItem) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/shares/${share.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: true }),
      });
      const data = (await response.json()) as {
        share?: ApiShare;
        password?: string;
        url?: string;
        error?: { message?: string };
      };
      if (!response.ok || !data.password) {
        throw new Error(data.error?.message ?? "Не удалось сменить пароль");
      }
      setCreated({
        url: displayUrl(data.url ?? share.url),
        password: data.password,
        label: share.label,
        expiresAtMs: share.expiresAtMs,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сменить пароль");
    } finally {
      setBusy(false);
    }
  };

  const activeCount = useMemo(
    () => shares.filter((share) => share.status === "active").length,
    [shares],
  );

  return (
    <div id="share" className="card-flat scroll-mt-24 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3.5">
        <div className="flex items-center gap-2">
          <Share2 className="size-4 text-ink-400" strokeWidth={1.8} />
          <h2 className="text-[13px] font-medium text-ink">Ссылки для получателей</h2>
        </div>
        <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-ink-300">
          {activeCount} {plural(activeCount, "активная", "активные", "активных")}
        </span>
      </div>

      {created ? (
        <div className="border-b border-orange/20 bg-orange-tint/70 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-orange-text">
                <ShieldCheck className="size-3.5" strokeWidth={2} />
                Ссылка готова
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                Пароль показывается один раз. Передайте его отдельно от ссылки.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreated(null)}
              className="text-[10px] text-ink-400 hover:text-ink"
            >
              Скрыть
            </button>
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <input
                readOnly
                value={created.url}
                className="mono h-9 min-w-0 flex-1 rounded-lg border border-orange/20 bg-white/70 px-2.5 text-[10px] text-ink-600 outline-none"
                onFocus={(event) => event.currentTarget.select()}
                aria-label="Ссылка"
              />
              <CopyButton value={created.url} label="Ссылка" className="shrink-0 border-orange/20 bg-white/70" />
            </div>
            <div className="flex items-center gap-1.5">
              <input
                readOnly
                value={created.password}
                className="mono h-9 min-w-0 flex-1 rounded-lg border border-orange/20 bg-white/70 px-2.5 text-[12px] tracking-[0.12em] text-ink outline-none"
                onFocus={(event) => event.currentTarget.select()}
                aria-label="Пароль"
              />
              <CopyButton value={created.password} label="Пароль" className="shrink-0 border-orange/20 bg-white/70" />
            </div>
            {created.expiresAtMs ? (
              <p className="mono text-[9.5px] text-ink-400">действует до {formatDateRu(created.expiresAtMs)}</p>
            ) : (
              <p className="mono text-[9.5px] text-ink-400">бессрочная ссылка</p>
            )}
            <ShareLinkButton
              url={created.url}
              title={recordingTitle}
              className="w-full border-orange/20 bg-white/70"
            />
          </div>
        </div>
      ) : null}

      <form onSubmit={create} className="space-y-3 px-4 py-4">
        <div>
          <label htmlFor="share-label" className="label">
            Кому (необязательно)
          </label>
          <input
            id="share-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={80}
            placeholder="Команде, клиенту, Ивану"
            className="input h-9 text-[12px]"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="share-password" className="label">
              Пароль
            </label>
            <input
              id="share-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={4}
              maxLength={128}
              autoComplete="new-password"
              placeholder="сгенерируем"
              className="input h-9 text-[12px]"
            />
          </div>
          <div>
            <label htmlFor="share-expiry" className="label">
              Срок
            </label>
            <select
              id="share-expiry"
              value={expiry}
              onChange={(event) => setExpiry(event.target.value)}
              className="input h-9 text-[12px]"
            >
              <option value="1">1 день</option>
              <option value="7">7 дней</option>
              <option value="30">30 дней</option>
              <option value="90">90 дней</option>
              <option value="never">Бессрочно</option>
            </select>
          </div>
        </div>
        {error ? <p className="text-[11px] leading-relaxed text-danger">{error}</p> : null}
        <button type="submit" disabled={busy} className="btn btn-primary btn-sm w-full">
          {busy ? (
            <RefreshCw className="size-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <Plus className="size-3.5" strokeWidth={2} />
          )}
          Создать ссылку с паролем
        </button>
        <p className="text-center text-[9.5px] leading-relaxed text-ink-300">
          Ссылка открывает только эту запись. Кабинет и другие записи остаются закрытыми.
        </p>
      </form>

      {shares.length ? (
        <div className="border-t border-hairline">
          <p className="px-4 pb-1 pt-3 text-[9.5px] font-medium uppercase tracking-[0.1em] text-ink-300">
            Созданные ссылки
          </p>
          <ul className="divide-y divide-hairline">
            {shares.map((share) => (
              <li key={share.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("size-1.5 rounded-full", STATUS_COLOR[share.status])} />
                      <span className="truncate text-[11.5px] font-medium text-ink">
                        {share.label || "Без названия"}
                      </span>
                      <span className="text-[9.5px] text-ink-300">{STATUS_LABEL[share.status]}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9.5px] text-ink-300">
                      <span className="flex items-center gap-1">
                        <CalendarClock className="size-2.5" strokeWidth={1.8} />
                        {share.expiresAtMs ? `до ${formatDateRu(share.expiresAtMs)}` : "бессрочно"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="size-2.5" strokeWidth={1.8} />
                        {share.accessCount} {plural(share.accessCount, "просмотр", "просмотра", "просмотров")}
                      </span>
                      {share.lastAccessAtMs ? (
                        <span className="truncate">последний {formatDateTimeRu(share.lastAccessAtMs)}</span>
                      ) : null}
                    </div>
                    <div className="mono mt-1.5 flex items-center gap-1 truncate text-[9.5px] text-ink-300">
                      <Link2 className="size-2.5 shrink-0" strokeWidth={1.8} />
                      <span className="truncate">{displayUrl(share.url)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <ShareLinkButton
                      url={displayUrl(share.url)}
                      title={recordingTitle}
                      label="Поделиться ссылкой"
                      iconOnly
                    />
                    <CopyButton value={displayUrl(share.url)} label="Ссылка" iconOnly />
                    {share.status !== "revoked" ? (
                      <button
                        type="button"
                        onClick={() => rotate(share)}
                        disabled={busy}
                        className="flex size-8 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-sunken hover:text-ink"
                        title="Новый пароль"
                        aria-label="Новый пароль"
                      >
                        <KeyRound className="size-3.5" strokeWidth={1.8} />
                      </button>
                    ) : null}
                    {share.status === "revoked" ? (
                      <button
                        type="button"
                        onClick={() => restore(share.id)}
                        disabled={busy}
                        className="flex size-8 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-sunken hover:text-ink"
                        title="Вернуть ссылку"
                        aria-label="Вернуть ссылку"
                      >
                        <Undo2 className="size-3.5" strokeWidth={1.8} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => revoke(share.id)}
                        disabled={busy}
                        className="flex size-8 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-danger-tint hover:text-danger"
                        title="Отозвать"
                        aria-label="Отозвать ссылку"
                      >
                        <Ban className="size-3.5" strokeWidth={1.8} />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="border-t border-hairline px-4 py-4 text-[11px] leading-relaxed text-ink-300">
          Ссылок пока нет. Создайте первую — получателю не нужен аккаунт.
        </div>
      )}
    </div>
  );
}
