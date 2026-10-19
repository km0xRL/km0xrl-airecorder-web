import Link from "next/link";
import { cn } from "@/lib/cn";

export function Logo({
  href = "/",
  compact = false,
  tone = "dark",
  className,
}: {
  href?: string | null;
  compact?: boolean;
  tone?: "dark" | "light";
  className?: string;
}) {
  const light = tone === "light";
  const content = (
    <span className={cn("inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap", className)}>
      <span
        className={cn(
          "relative flex size-8 shrink-0 items-center justify-center rounded-[10px]",
          light ? "bg-white" : "bg-ink shadow-[0_1px_0_rgba(255,255,255,0.12)_inset]",
        )}
      >
        <svg viewBox="0 0 32 32" className="size-5" aria-hidden="true">
          <rect x="6" y="13" width="2.6" height="6" rx="1.3" fill="#FF4D00" />
          <rect x="11.2" y="9.5" width="2.6" height="13" rx="1.3" fill={light ? "#0A0A0A" : "#FFFFFF"} />
          <rect x="16.4" y="6.5" width="2.6" height="19" rx="1.3" fill={light ? "#0A0A0A" : "#FFFFFF"} />
          <rect x="21.6" y="11" width="2.6" height="10" rx="1.3" fill="#FF4D00" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-[16px] font-medium tracking-[-0.03em] sm:text-[17px]",
            light ? "text-white" : "text-ink",
          )}
        >
          AI Recorder
        </span>
        {!compact && (
          <span
            className={cn(
              "mt-1 hidden font-mono text-[9px] uppercase tracking-[0.16em] sm:block",
              light ? "text-white/40" : "text-ink-300",
            )}
          >
            записи встреч
          </span>
        )}
      </span>
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} className="shrink-0 rounded-xl outline-offset-4" aria-label="AI Recorder — на главную">
      {content}
    </Link>
  );
}
