import { cn } from "@/lib/cn";

export function TagChip({ tag, className }: { tag: string; className?: string }) {
  return <span className={cn("chip", className)}>#{tag}</span>;
}
