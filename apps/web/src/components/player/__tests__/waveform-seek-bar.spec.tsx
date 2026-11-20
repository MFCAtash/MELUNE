import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Controllable peaks: `null` exercises the fallback path, an array the
// real waveform path — without needing a Web Audio implementation,
// which jsdom does not have.
let mockedPeaks: number[] | null = null;
vi.mock("@/hooks/use-track-peaks", () => ({
  useTrackPeaks: () => mockedPeaks,
  PEAK_BUCKETS: 96,
}));

import { WaveformSeekBar } from "../waveform-seek-bar";

function renderBar(overrides: Partial<React.ComponentProps<typeof WaveformSeekBar>> = {}) {
  return render(
    <WaveformSeekBar
      currentTime={30}
      duration={120}
      onSeek={vi.fn()}
      audioUrl="https://example.com/track.mp3"
      {...overrides}
    />,
  );
}

describe("WaveformSeekBar", () => {
  beforeEach(() => {
    mockedPeaks = null;
  });

  it("falls back to the plain seek bar while peaks are unavailable", () => {
    renderBar();
    expect(screen.getByRole("slider")).toBeTruthy();
    // No waveform artwork in the fallback.
    expect(document.querySelector(".waveform-seek")).toBeNull();
  });

  it("draws a real waveform once peaks resolve", () => {
    mockedPeaks = Array.from({ length: 96 }, (_, i) => (i % 10) / 10);
    renderBar();
    expect(document.querySelector(".waveform-seek__svg")).not.toBeNull();
    // Two groups (dim silhouette + played highlight) → 2 rects per peak.
    const rects = document.querySelectorAll(".waveform-seek__svg rect");
    expect(rects.length).toBeGreaterThanOrEqual(96);
  });

  it("seeks to the chosen second", () => {
    mockedPeaks = new Array(32).fill(0.5);
    const onSeek = vi.fn();
    renderBar({ onSeek });
    fireEvent.change(screen.getByRole("slider"), { target: { value: "75" } });
    expect(onSeek).toHaveBeenCalledWith(75);
  });

  it("uses the ambient track color and keeps the control accessible", () => {
    mockedPeaks = new Array(16).fill(0.8);
    renderBar({ ambientColor: "#3ddc97" });
    const slider = screen.getByRole("slider");
    expect(slider.getAttribute("aria-label")).toBeTruthy();
    const wrapper = document.querySelector(".waveform-seek") as HTMLElement;
    expect(wrapper.style.color).toBe("rgb(61, 220, 151)");
  });

  it("hides the numeric time labels in compact mode", () => {
    mockedPeaks = new Array(16).fill(0.3);
    const { container } = renderBar({ compact: true });
    expect(container.textContent).toBe("");
  });
});
