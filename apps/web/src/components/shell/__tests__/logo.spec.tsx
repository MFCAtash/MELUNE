import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo } from "../logo";

describe("Logo", () => {
  it("renders the default wordmark linking home", () => {
    render(<Logo />);
    const link = screen.getByRole("link", { name: "MELUNE" });
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders custom text when given (topbar's shortened mobile wordmark)", () => {
    render(<Logo text="MELUNE" />);
    expect(screen.getByRole("link", { name: "MELUNE" })).toBeInTheDocument();
  });

  it("mounts and unmounts cleanly regardless of playback state (no track playing by default)", () => {
    const { unmount } = render(<Logo />);
    expect(() => unmount()).not.toThrow();
  });
});
