import { Mic } from "lucide-react";

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-[22px] border border-dashed border-border-soft bg-card/60 px-6 py-16 text-center">
      <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-sunken text-ink-400">
        <Mic className="size-6" strokeWidth={1.6} />
      </span>
      <h2 className="font-display text-xl font-medium tracking-[-0.02em] text-ink">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-400">{description}</p>
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}
