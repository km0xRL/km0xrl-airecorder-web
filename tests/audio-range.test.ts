import { describe, expect, it } from "vitest";
import { parseRange } from "@/lib/audio-range";

describe("parseRange", () => {
  it("без заголовка отдаёт файл целиком", () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange(undefined, 100)).toBeNull();
  });

  it("явный диапазон", () => {
    expect(parseRange("bytes=0-9", 100)).toEqual({ start: 0, end: 9 });
    expect(parseRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
  });

  it("открытый конец и суффикс", () => {
    expect(parseRange("bytes=10-", 100)).toEqual({ start: 10, end: 99 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=-1000", 100)).toEqual({ start: 0, end: 99 });
  });

  it("обрезает конец по размеру файла", () => {
    expect(parseRange("bytes=0-999", 100)).toEqual({ start: 0, end: 99 });
  });

  it("невозможные диапазоны", () => {
    expect(parseRange("bytes=100-200", 100)).toBe("invalid");
    expect(parseRange("bytes=5-2", 100)).toBe("invalid");
    expect(parseRange("bytes=", 100)).toBe("invalid");
    expect(parseRange("items=0-1", 100)).toBe("invalid");
    expect(parseRange("bytes=0-1,2-3", 100)).toBe("invalid");
    expect(parseRange("bytes=abc-def", 100)).toBe("invalid");
    expect(parseRange("bytes=-0", 100)).toBe("invalid");
    expect(parseRange("bytes=0-0", 0)).toBe("invalid");
  });
});
