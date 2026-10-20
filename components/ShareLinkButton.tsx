"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Поделиться ссылкой: на телефоне — системное окно «Поделиться» (WhatsApp, Telegram и т.п.),
 * на компьютере или без Web Share API — копирование в буфер. Пароль сюда не попадает:
 * его передают отдельно от ссылки.
 */
export function ShareLinkButton({
  url,
  title,
  label = "Поделиться ссылкой",
  iconOnly = false,
  className,
}: {
  url: string;
  title?: string;
  label?: string;
  iconOnly?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const area = document.createElement("textarea");
        area.value = url;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // Буфер может быть запрещён — останется выделить ссылку вручную.
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || "AI Recorder",
          text: title ? `${title}\n${url}` : url,
          url,
        });
        return;
      } catch (error) {
        // Закрыли окно — ничего не делаем; другая ошибка — копируем.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copy();
  };

  return (
    <button
      type="button"
      onClick={() => void share()}
      className={cn(
        "btn btn-outline btn-sm",
        iconOnly && "size-8 min-h-0 px-0",
        copied && "border-emerald-200 bg-emerald-50 text-emerald-700",
        className,
      )}
      aria-label={copied ? "Ссылка скопирована" : label}
      title={copied ? "Ссылка скопирована" : label}
    >
      {copied ? (
        <Check className="size-3.5" strokeWidth={2} />
      ) : (
        <Share2 className="size-3.5" strokeWidth={1.9} />
      )}
      {!iconOnly ? (copied ? "Скопировано" : label) : null}
    </button>
  );
}
