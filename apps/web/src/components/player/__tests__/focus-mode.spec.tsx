import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { Song } from "@melune/types";
import { usePlayerStore } from "@/store/player-store";
import { FocusMode } from "../focus-mode";

const TRACK: Song = {
  id: "song-1",
  title: "Midnight Drive",
  slug: "midnight-drive",
  duration: 200,
  audioUrl: "https://example.com/midnight-drive.mp3",
  coverUrl: null,
  playCount: 42,
  artist: { id: "artist-1", name: "Nova Ray", slug: "nova-ray", imageUrl: null },
  album: null,
  genre: null,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  usePlayerStore.setState({
    queue: [TRACK],
    originalQueue: [TRACK],
    currentIndex: 0,
    isPlaying: true,
    currentTime: 0,
    duration: 200,
  });
});
afterEach(() => vi.useRealTimers());

const timer = () => screen.getByTestId("focus-timer");

describe("FocusMode", () => {
  it("is a labelled modal dialog with a timer and a pause button — and no visualizer", () => {
    const { container } = render(<FocusMode onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Focus mode: Midnight Drive" })).toHaveAttribute("aria-modal", "true");
    expect(timer()).toHaveTextContent("00:00");
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("the big button toggles playback", () => {
    render(<FocusMode onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  it("the timer runs while playing and stops while paused", () => {
    render(<FocusMode onClose={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(timer()).toHaveTextContent("00:05");

    act(() => usePlayerStore.setState({ isPlaying: false }));
    expect(screen.getByText("Paused")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(timer()).toHaveTextContent("00:05");
  });

  it("cycles session length into a countdown and restarts the clock", () => {
    render(<FocusMode onClose={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Change session length" }));

    expect(screen.getByRole("button", { name: "Change session length" })).toHaveTextContent("25 min");
    expect(timer()).toHaveTextContent("25:00");

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(timer()).toHaveTextContent("24:58");
  });

  it("reset returns the clock to zero", () => {
    render(<FocusMode onClose={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(7000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset timer" }));
    expect(timer()).toHaveTextContent("00:00");
  });

  it("shows a completion message when a countdown reaches zero", () => {
    render(<FocusMode onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Change session length" })); // 25 min
    act(() => {
      vi.advanceTimersByTime(25 * 60 * 1000);
    });
    expect(timer()).toHaveTextContent("00:00");
    expect(screen.getByText("Session complete")).toBeInTheDocument();
  });

  it("exit button calls onClose", () => {
    const onClose = vi.fn();
    render(<FocusMode onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Exit focus mode" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing without a current track", () => {
    usePlayerStore.setState({ queue: [], originalQueue: [], currentIndex: -1 });
    const { container } = render(<FocusMode onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
