"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { activeSegmentIndex } from "@/lib/speakers";
import type { DisplaySegment, Mark } from "@/lib/types";

interface PlaybackState {
  available: boolean;
  currentTime: number;
  duration: number;
  playing: boolean;
  rate: number;
  error: boolean;
  segments: DisplaySegment[];
  marks: Mark[];
  activeIndex: number;
  seekTo: (time: number, autoplay?: boolean) => void;
  toggle: () => void;
  skip: (delta: number) => void;
  setRate: (rate: number) => void;
  audioRef: RefObject<HTMLAudioElement | null>;
}

const PlaybackContext = createContext<PlaybackState | null>(null);

export function PlaybackProvider({
  src,
  duration,
  segments,
  marks,
  children,
}: {
  src: string | null;
  duration: number | null;
  segments: DisplaySegment[];
  marks: Mark[];
  children: ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(duration ?? 0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  const [error, setError] = useState(false);

  const available = Boolean(src) && !error;
  const effectiveDuration = mediaDuration > 0 ? mediaDuration : duration ?? 0;

  const seekTo = useCallback(
    (time: number, autoplay = true) => {
      const audio = audioRef.current;
      if (!audio) return;
      const max = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : effectiveDuration;
      const target = Math.max(0, Math.min(time, max || time));
      try {
        audio.currentTime = target;
      } catch {
        // Метаданные ещё не загрузились — браузер применит позицию после loadedmetadata.
      }
      setCurrentTime(target);
      if (autoplay) void audio.play().catch(() => undefined);
    },
    [effectiveDuration],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setError(true));
    else audio.pause();
  }, []);

  const skip = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      seekTo((Number.isFinite(audio.currentTime) ? audio.currentTime : 0) + delta, false);
    },
    [seekTo],
  );

  const setRate = useCallback((value: number) => {
    setRateState(value);
    if (audioRef.current) audioRef.current.playbackRate = value;
  }, []);

  const activeIndex = useMemo(
    () => activeSegmentIndex(segments, currentTime),
    [segments, currentTime],
  );

  const value = useMemo<PlaybackState>(
    () => ({
      available,
      currentTime,
      duration: effectiveDuration,
      playing,
      rate,
      error,
      segments,
      marks,
      activeIndex,
      seekTo,
      toggle,
      skip,
      setRate,
      audioRef,
    }),
    [
      available,
      currentTime,
      effectiveDuration,
      playing,
      rate,
      error,
      segments,
      marks,
      activeIndex,
      seekTo,
      toggle,
      skip,
      setRate,
    ],
  );

  return (
    <PlaybackContext.Provider value={value}>
      {src ? (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          className="hidden"
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => {
            const audio = event.currentTarget;
            audio.playbackRate = rate;
            if (Number.isFinite(audio.duration) && audio.duration > 0) {
              setMediaDuration(audio.duration);
            }
          }}
          onDurationChange={(event) => {
            const next = event.currentTarget.duration;
            if (Number.isFinite(next) && next > 0) setMediaDuration(next);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => setError(true)}
        />
      ) : null}
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback(): PlaybackState {
  const value = useContext(PlaybackContext);
  if (!value) throw new Error("usePlayback должен использоваться внутри PlaybackProvider");
  return value;
}
