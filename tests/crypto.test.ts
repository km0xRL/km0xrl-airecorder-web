import { describe, expect, it } from "vitest";
import {
  hashPassword,
  packSigned,
  randomPassword,
  safeEqualStrings,
  signValue,
  unpackSigned,
  verifyPassword,
} from "@/lib/crypto";

describe("пароли ссылок", () => {
  it("хеширует и проверяет пароль", async () => {
    const hash = await hashPassword("ко-рректный пароль");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("ко-рректный пароль", hash)).toBe(true);
    expect(await verifyPassword("другой", hash)).toBe(false);
  });

  it("не падает на мусорном хеше", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "scrypt$1$1$1$aa$bb")).toBe(false);
  });

  it("генерирует читаемый пароль", () => {
    const password = randomPassword(10);
    expect(password).toHaveLength(10);
    expect(password).toMatch(/^[a-hj-km-np-z2-9]+$/);
    expect(password).not.toBe(randomPassword(10));
  });
});

describe("подпись cookie", () => {
  const secret = "test-secret-at-least-16-chars";

  it("принимает свою подпись", () => {
    const packed = packSigned("owner:123", secret);
    expect(unpackSigned(packed, secret)).toBe("owner:123");
  });

  it("не принимает чужую и подделанную", () => {
    const packed = packSigned("owner:123", secret);
    expect(unpackSigned(packed, "other-secret-at-least-16")).toBeNull();
    expect(unpackSigned(`${packed}x`, secret)).toBeNull();
    expect(unpackSigned("owner:123", secret)).toBeNull();
  });

  it("сравнивает строки без утечки длины", () => {
    expect(safeEqualStrings("abc", "abc")).toBe(true);
    expect(safeEqualStrings("abc", "abcd")).toBe(false);
    expect(signValue("a", secret)).not.toBe(signValue("b", secret));
  });
});
