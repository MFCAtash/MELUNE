import { slugify } from "./slugify";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips punctuation", () => {
    expect(slugify("Don't Stop Believin'!")).toBe("dont-stop-believin");
  });

  it("collapses repeated whitespace/hyphens", () => {
    expect(slugify("A    B---C")).toBe("a-b-c");
  });

  it("trims leading/trailing whitespace", () => {
    expect(slugify("  Padded  ")).toBe("padded");
  });
});
