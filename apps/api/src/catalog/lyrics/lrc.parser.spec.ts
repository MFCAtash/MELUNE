import { parseLrc } from "./lrc.parser";

describe("parseLrc", () => {
  it("parses standard and hundredths timestamps, sorted by time", () => {
    const lrc = [
      "[ti:Example]",
      "[ar:Nova Ray]",
      "[00:08.50]Second line",
      "[00:03.20]First line",
      "[01:02.500]Third line",
    ].join("\n");

    expect(parseLrc(lrc)).toEqual([
      { timeSeconds: 3.2, text: "First line" },
      { timeSeconds: 8.5, text: "Second line" },
      { timeSeconds: 62.5, text: "Third line" },
    ]);
  });

  it("supports multiple timestamps on one line and strips word timings", () => {
    const lrc = "[00:01.00][00:05.00]<00:01.00>Hello <00:01.40>world";
    expect(parseLrc(lrc)).toEqual([
      { timeSeconds: 1, text: "Hello world" },
      { timeSeconds: 5, text: "Hello world" },
    ]);
  });

  it("keeps Persian text intact and skips malformed lines", () => {
    const lrc = ["not a lyric line", "[00:12.00]ملون · موسیقی شما", "[ab:cd]ignored"].join("\n");
    expect(parseLrc(lrc)).toEqual([{ timeSeconds: 12, text: "ملون · موسیقی شما" }]);
  });

  it("returns an empty array for empty or malformed input", () => {
    expect(parseLrc("")).toEqual([]);
    expect(parseLrc("[00:xx]nothing")).toEqual([]);
  });
});
