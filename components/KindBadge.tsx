import { Phone, Users, Video } from "lucide-react";
import { cn } from "@/lib/cn";
import { kindLabel } from "@/lib/format";
import type { RecordingKind } from "@/lib/types";

export function KindBadge({ kind, className }: { kind: RecordingKind; className?: string }) {
  const Icon = kind === "meeting" ? Users : kind === "online_call" ? Video : Phone;
  return (
    <span className={cn("chip", className)}>
      <Icon className="size-3" strokeWidth={1.9} />
      {kindLabel(kind)}
    </span>
  );
}
