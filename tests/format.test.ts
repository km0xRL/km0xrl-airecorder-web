import { describe, expect, it } from "vitest";
import { formatBytes, formatDuration, formatHoursTotal, plural } from "@/lib/format";

describe("форматирование", () => {
  it("длительность", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(82.2)).toBe("1:22");
    expect(formatDuration(3723)).toBe("1:02:03");
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(-1)).toBe("—");
  });

  it("размер файла", () => {
    expect(formatBytes(0)).toBe("0 Б");
    expect(formatBytes(670_000)).toBe("654 КБ");
    expect(formatBytes(2 * 1024 ** 3)).toBe("2,0 ГБ");
  });

  it("часы", () => {
    expect(formatHoursTotal(1800)).toBe("30 мин");
    expect(formatHoursTotal(5400)).toBe("1,5 ч");
    expect(formatHoursTotal(36_000)).toBe("10 ч");
  });

  it("русские окончания", () => {
    expect(plural(1, "запись", "записи", "записей")).toBe("запись");
    expect(plural(2, "запись", "записи", "записей")).toBe("записи");
    expect(plural(5, "запись", "записи", "записей")).toBe("записей");
    expect(plural(11, "запись", "записи", "записей")).toBe("записей");
  });
});
