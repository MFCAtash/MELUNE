import { describe, it, expect } from "vitest";
import { formatDuration, formatTotalDuration } from "../format";

describe("formatDuration", () => {
  it("formats m:ss", () => {
    expect(formatDuration(65)).toBe("1:05");
  });
});

describe("formatTotalDuration", () => {
  it("uses minutes under an hour and never shows 0 min", () => {
    expect(formatTotalDuration(48 * 60)).toBe("48 min");
    expect(formatTotalDuration(10)).toBe("1 min");
  });

  it("uses hours and minutes above an hour", () => {
    expect(formatTotalDuration(72 * 60)).toBe("1 hr 12 min");
    expect(formatTotalDuration(2 * 3600)).toBe("2 hr");
  });
});
