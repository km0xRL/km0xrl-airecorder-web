"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";

export function CopyButton({
  value,
  label = "Копировать",
  iconOnly = false,
  className,
}: {
  value: string;
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
        await navigator.clipboard.writeText(value);
      } else {
        const area = document.createElement("textarea");
        area.value = value;
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
      // Буфер обмена может быть запрещён — пользователь скопирует вручную.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "btn btn-outline btn-sm",
        iconOnly && "size-8 min-h-0 px-0",
        copied && "border-emerald-200 bg-emerald-50 text-emerald-700",
        className,
      )}
      aria-label={copied ? "Скопировано" : label}
      title={copied ? "Скопировано" : label}
    >
      {copied ? (
        <Check className="size-3.5" strokeWidth={2} />
      ) : (
        <Copy className="size-3.5" strokeWidth={1.9} />
      )}
      {!iconOnly ? (copied ? "Скопировано" : label) : null}
    </button>
  );
}
