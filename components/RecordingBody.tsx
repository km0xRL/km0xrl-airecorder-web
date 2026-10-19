"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, FileText } from "lucide-react";
import { NoAudioNotice } from "@/components/NoAudioNotice";
import { PlaybackProvider } from "@/components/PlaybackProvider";
import { PlayerBar } from "@/components/PlayerBar";
import { ReportView } from "@/components/ReportView";
import { TranscriptView } from "@/components/TranscriptView";
import { cn } from "@/lib/cn";
import { buildDisplaySegments } from "@/lib/speakers";
import type { Recording } from "@/lib/types";

type Tab = "report" | "transcript";

export function RecordingBody({
  recording,
  audioUrl,
  pdfUrl,
  mode,
}: {
  recording: Recording;
  audioUrl: string | null;
  pdfUrl: string | null;
  mode: "owner" | "share";
}) {
  const segments = useMemo(
    () =>
      buildDisplaySegments(
        recording.transcript,
        recording.speakerNames,
        recording.speakerOverrides,
        recording.marks,
      ),
    [recording],
  );

  const hasReport = Boolean(recording.report) || recording.hints.length > 0;
  const hasTranscript = Boolean(recording.transcript?.text || segments.length);
  const hasAudio = Boolean(audioUrl);

  const [tab, setTab] = useState<Tab>(() => (hasReport ? "report" : "transcript"));
  const both = hasReport && hasTranscript;

  return (
    <PlaybackProvider src={audioUrl} duration={recording.durationS} segments={segments} marks={recording.marks}>
      {hasAudio ? (
        <div className="sticky top-16 z-30 -mx-1 mb-3 rounded-2xl bg-canvas/90 px-1 py-1 backdrop-blur-xl">
          <PlayerBar recordingId={recording.id} canEdit={mode === "owner"} />
        </div>
      ) : (
        <NoAudioNotice mode={mode} />
      )}

      {both ? (
        <div className="mt-5 inline-flex rounded-full bg-sunken p-1" role="tablist" aria-label="Содержимое записи">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "report"}
            onClick={() => setTab("report")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-medium transition-colors",
              tab === "report" ? "bg-card text-ink shadow-sm" : "text-ink-400 hover:text-ink",
            )}
          >
            <ClipboardCheck className="size-3.5" strokeWidth={1.9} />
            Отчёт
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "transcript"}
            onClick={() => setTab("transcript")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-medium transition-colors",
              tab === "transcript" ? "bg-card text-ink shadow-sm" : "text-ink-400 hover:text-ink",
            )}
          >
            <FileText className="size-3.5" strokeWidth={1.9} />
            Расшифровка
            {segments.length ? (
              <span className="mono text-[9.5px] text-ink-300">{segments.length}</span>
            ) : null}
          </button>
        </div>
      ) : null}

      <div className={cn(both ? "mt-4" : "mt-4")} role="tabpanel">
        {both ? (
          tab === "report" ? (
            <ReportView
              report={recording.report}
              hints={recording.hints}
              hasAudio={hasAudio}
              pdfUrl={pdfUrl}
            />
          ) : (
            <TranscriptView
                segments={segments}
                text={recording.transcript?.text ?? null}
                hasAudio={hasAudio}
                canEdit={mode === "owner"}
                recordingId={recording.id}
                speakerOverrides={recording.speakerOverrides}
              />
          )
        ) : hasReport ? (
          <ReportView
            report={recording.report}
            hints={recording.hints}
            hasAudio={hasAudio}
            pdfUrl={pdfUrl}
          />
        ) : (
          <TranscriptView
            segments={segments}
            text={recording.transcript?.text ?? null}
            hasAudio={hasAudio}
            canEdit={mode === "owner"}
            recordingId={recording.id}
            speakerOverrides={recording.speakerOverrides}
          />
        )}
      </div>
    </PlaybackProvider>
  );
}
