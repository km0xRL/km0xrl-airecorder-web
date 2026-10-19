import { describe, expect, it } from "vitest";
import {
  activeSegmentIndex,
  buildDisplaySegments,
  markTouches,
  speakerColor,
  uniqueSpeakerNames,
} from "@/lib/speakers";
import type { Transcript } from "@/lib/types";

const transcript: Transcript = {
  text: "Привет. Как дела?",
  segments: [
    { start: 0, end: 5, speaker: "Спикер 1", text: "Привет." },
    { start: 5, end: 9, speaker: "Спикер 2", text: "Как дела?" },
    { start: 9, end: 12, speaker: "Спикер 1", text: "Хорошо." },
  ],
};

describe("говорящие и фразы", () => {
  it("подставляет имена и поправки", () => {
    const segments = buildDisplaySegments(
      transcript,
      { "Спикер 1": "Михаил" },
      { 1: "Спикер 1" },
      [],
    );
    expect(segments.map((segment) => segment.name)).toEqual(["Михаил", "Михаил", "Михаил"]);
    expect(segments.map((segment) => segment.colorIndex)).toEqual([0, 0, 0]);
  });

  it("даёт разным говорящим разные цвета", () => {
    const segments = buildDisplaySegments(transcript, { "Спикер 1": "Михаил", "Спикер 2": "Анна" }, {}, []);
    expect(segments[0]!.colorIndex).toBe(0);
    expect(segments[1]!.colorIndex).toBe(1);
    expect(uniqueSpeakerNames(segments)).toHaveLength(2);
    expect(speakerColor(0).solid).not.toBe(speakerColor(1).solid);
  });

  it("помечает фразы, которых касается маркер", () => {
    const segments = buildDisplaySegments(transcript, {}, {}, [{ start: 4, end: 6 }]);
    expect(segments.map((segment) => segment.marked)).toEqual([true, true, false]);
    expect(markTouches({ start: 4, end: 5 }, 5, 9)).toBe(false);
    expect(markTouches({ start: 4, end: 5 }, 4.5, 9)).toBe(true);
  });

  it("находит звучащую фразу и предыдущую в паузе", () => {
    expect(activeSegmentIndex(buildDisplaySegments(transcript, {}, {}, []), 2)).toBe(0);
    expect(activeSegmentIndex(buildDisplaySegments(transcript, {}, {}, []), 6)).toBe(1);
    expect(activeSegmentIndex(buildDisplaySegments(transcript, {}, {}, []), 9.5)).toBe(2);
    expect(activeSegmentIndex(buildDisplaySegments(transcript, {}, {}, []), 20)).toBe(2);
    expect(activeSegmentIndex([], 1)).toBe(-1);
  });
});
