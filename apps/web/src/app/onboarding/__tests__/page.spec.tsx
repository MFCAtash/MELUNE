import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OnboardingPage from "../page";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const GENRES = [
  { id: "g1", name: "Lo-fi" },
  { id: "g2", name: "Synthwave" },
  { id: "g3", name: "Persian Pop" },
  { id: "g4", name: "Jazz" },
];

vi.mock("@/lib/queries", () => ({
  useGenres: () => ({ data: GENRES, isLoading: false, isError: false }),
}));

describe("OnboardingPage (Tinder-style swipe deck)", () => {
  beforeEach(() => {
    push.mockClear();
    localStorage.clear();
  });

  it("shows one genre card at a time, not the old grid of every genre at once", () => {
    render(<OnboardingPage />);
    expect(screen.getByText("Lo-fi")).toBeInTheDocument();
    expect(screen.queryByText("Synthwave")).not.toBeInTheDocument();
  });

  it("tapping Like advances to the next card and counts toward the selection", () => {
    render(<OnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: /Like Lo-fi/ }));
    expect(screen.getByText("Synthwave")).toBeInTheDocument();
  });

  it("tapping Skip advances without adding to the selection", () => {
    render(<OnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: /Skip Lo-fi/ }));
    fireEvent.click(screen.getByRole("button", { name: /Skip Synthwave/ }));
    fireEvent.click(screen.getByRole("button", { name: /Skip Persian Pop/ }));
    fireEvent.click(screen.getByRole("button", { name: /Skip Jazz/ }));
    // Deck exhausted, nothing liked — summary should say so and gate Continue.
    expect(screen.getByText("No genres picked yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Continue$/ })).toBeDisabled();
  });

  it("reaching the end of the deck after liking enough genres enables Continue", () => {
    render(<OnboardingPage />);
    for (const genre of GENRES) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`Like ${genre.name}`) }));
    }
    expect(screen.getByRole("button", { name: /Continue \(4\)/ })).toBeEnabled();
  });

  it("Continue persists the picks and navigates to the redirect destination", () => {
    render(<OnboardingPage />);
    for (const genre of GENRES.slice(0, 3)) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`Like ${genre.name}`) }));
    }
    fireEvent.click(screen.getByRole("button", { name: /Skip Jazz/ }));
    fireEvent.click(screen.getByRole("button", { name: /Continue \(3\)/ }));

    const stored = JSON.parse(localStorage.getItem("melune-onboarding-genres") ?? "[]");
    expect(stored).toEqual(["g1", "g2", "g3"]);
    expect(push).toHaveBeenCalledWith("/home");
  });

  it("Skip for now marks onboarding as seen with no genres and navigates away", () => {
    render(<OnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(localStorage.getItem("melune-onboarding-genres")).toBe("[]");
    expect(push).toHaveBeenCalledWith("/home");
  });

  it("Restart picks resets the deck back to the first card", () => {
    render(<OnboardingPage />);
    for (const genre of GENRES) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`Skip ${genre.name}`) }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Restart picks" }));
    expect(screen.getByText("Lo-fi")).toBeInTheDocument();
  });
});
