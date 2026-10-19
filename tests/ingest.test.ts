import { describe, expect, it } from "vitest";
import { IngestValidationError, isValidClientId, parseIngestPayload } from "@/lib/ingest";

const now = 1_800_000_000_000;

describe("приём записи", () => {
  it("собирает полный документ", () => {
    const result = parseIngestPayload(
      "rec_20260913_1104_7f3a",
      {
        source_name: "2026-09-13 11-04 встреча.m4a",
        kind: "meeting",
        origin_device: "SM-S938B",
        title: "Планёрка",
        recorded_at: "2026-09-13T11:04:12+03:00",
        duration_s: 2060,
        tags: ["tag-1", "tag-2"],
        tag_titles: { "tag-1": "релиз", "tag-2": "команда" },
        speaker_names: { "Спикер 1": "Михаил" },
        transcript: {
          text: "",
          segments: [
            { start: 0, end: 6.4, speaker: "Спикер 1", text: "Коллеги, начинаем." },
            { start: 6.4, end: 14.1, speaker: "Спикер 1", text: "Первый вопрос." },
          ],
        },
        report: {
          title: "Умное название",
          summary: ["Итог"],
          decisions: ["Решение"],
          tasks: [{ title: "Сделать", assignee: "Михаил", due: "20 сентября" }],
          tags: ["tag-1"],
        },
        marks: [{ start: 8, end: 7 }, { start: 0, end: 1 }],
        updated_at_ms: now,
      },
      now,
    );

    expect(result.title).toBe("Планёрка");
    expect(result.tags).toEqual(["релиз", "команда"]);
    expect(result.transcript?.text).toBe("Коллеги, начинаем. Первый вопрос.");
    expect(result.transcript?.segments).toHaveLength(2);
    expect(result.report?.tasks[0]).toEqual({ title: "Сделать", assignee: "Михаил", due: "20 сентября" });
    expect(result.marks).toEqual([
      { start: 0, end: 1 },
      { start: 8, end: 8 },
    ]);
    expect(result.recordedAtMs).toBe(Date.parse("2026-09-13T11:04:12+03:00"));
    expect(result.searchText).toContain("первый вопрос");
  });

  it("берёт умное название и kind из source", () => {
    const result = parseIngestPayload("rec-1", {
      source: "call",
      source_name: "звонок.m4a",
      report: { title: "Звонок с клиентом" },
      transcript: { text: "Текст" },
      updated_at_ms: now,
    });
    expect(result.kind).toBe("phone_call");
    expect(result.title).toBe("Звонок с клиентом");
    expect(result.recordedAtMs).toBeNull();
  });

  it("не даёт пустой или опасный client_id", () => {
    expect(isValidClientId("rec_20260913_1104_7f3a")).toBe(true);
    expect(isValidClientId("a/b")).toBe(false);
    expect(isValidClientId("x".repeat(101))).toBe(false);
    expect(() => parseIngestPayload("../bad", {}, now)).toThrow(IngestValidationError);
  });

  it("отклоняет мусор и слишком длинные поля", () => {
    expect(() => parseIngestPayload("rec-1", { title: 123 }, now)).toThrow(IngestValidationError);
    expect(() => parseIngestPayload("rec-1", { tags: "не массив" }, now)).toThrow(IngestValidationError);
  });

  it("поддерживает удаление", () => {
    const result = parseIngestPayload("rec-1", { deleted: true, updated_at_ms: now }, now);
    expect(result.deleted).toBe(true);
  });
});
