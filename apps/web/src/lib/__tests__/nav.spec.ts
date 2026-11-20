import { describe, it, expect } from "vitest";
import { isActive, isShellRoute, safeRedirect } from "../nav";

describe("isActive", () => {
  it("matches the exact route and nested routes", () => {
    expect(isActive("/library", "/library")).toBe(true);
    expect(isActive("/playlist/road-trip", "/playlist")).toBe(true);
  });

  it("does not match a route that merely shares a prefix", () => {
    expect(isActive("/library-old", "/library")).toBe(false);
    expect(isActive("/homework", "/home")).toBe(false);
  });
});

describe("isShellRoute", () => {
  it("is true for in-app pages and false for landing/auth", () => {
    expect(isShellRoute("/home")).toBe(true);
    expect(isShellRoute("/album/abbey-road")).toBe(true);
    expect(isShellRoute("/")).toBe(false);
    expect(isShellRoute("/login")).toBe(false);
  });
});

describe("safeRedirect", () => {
  it("allows same-site paths", () => {
    expect(safeRedirect("/library")).toBe("/library");
    expect(safeRedirect("/playlist/mix?x=1")).toBe("/playlist/mix?x=1");
  });

  it("falls back for missing or unsafe targets", () => {
    expect(safeRedirect(null)).toBe("/home");
    expect(safeRedirect("https://evil.example")).toBe("/home");
    expect(safeRedirect("//evil.example")).toBe("/home");
    expect(safeRedirect("/\\evil.example")).toBe("/home");
  });
});
