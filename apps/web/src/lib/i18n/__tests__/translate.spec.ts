import { describe, it, expect } from "vitest";
import { translate } from "../translate";
import { localeDirection, isLocale } from "../config";

describe("translate", () => {
  it("resolves a nested key for the requested locale", () => {
    expect(translate("en", "player.play")).toBe("Play");
    expect(translate("fa", "player.play")).toBe("پخش");
  });

  it("interpolates {{var}} placeholders", () => {
    expect(translate("en", "queue.trackPosition", { index: 2, total: 5 })).toBe("2 of 5");
    expect(translate("fa", "queue.trackPosition", { index: 2, total: 5 })).toBe("2 از 5");
  });

  it("falls back to the raw key for an unknown path", () => {
    // @ts-expect-error - intentionally invalid key to test the fallback
    expect(translate("en", "nope.nope")).toBe("nope.nope");
  });
});

describe("localeDirection", () => {
  it("marks Persian as RTL and English as LTR", () => {
    expect(localeDirection("fa")).toBe("rtl");
    expect(localeDirection("en")).toBe("ltr");
  });
});

describe("isLocale", () => {
  it("accepts known locales and rejects everything else", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fa")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
