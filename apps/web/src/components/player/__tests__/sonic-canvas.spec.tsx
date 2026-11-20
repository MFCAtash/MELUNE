import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { createRef } from "react";
import { SonicCanvas, type SonicCanvasMode } from "../sonic-canvas";

// jsdom doesn't implement a 2D canvas context (getContext("2d") returns
// null), so these tests deliberately can't assert pixel output — that's
// the same ceiling every canvas-based component in this codebase hits.
// What we *can* and must verify: the component mounts/unmounts cleanly
// (no thrown errors from the rAF/ResizeObserver/AudioContext setup paths)
// across every mode and both playing states, and renders a real <canvas>.
describe("SonicCanvas", () => {
  const modes: SonicCanvasMode[] = ["bars", "wave", "aurora", "particles", "minimal"];

  it.each(modes)("mounts and unmounts without throwing in %s mode while playing", (mode) => {
    const { container, unmount } = render(<SonicCanvas isPlaying mode={mode} color="#8b5cf6" />);
    expect(container.querySelector("canvas")).toBeInTheDocument();
    expect(() => unmount()).not.toThrow();
  });

  it("renders a static (non-throwing) frame when isPlaying is false", () => {
    const { container, unmount } = render(<SonicCanvas isPlaying={false} mode="bars" />);
    expect(container.querySelector("canvas")).toBeInTheDocument();
    unmount();
  });

  it("marks the canvas aria-hidden, matching the previous CSS visualizer's decorative role", () => {
    const { container } = render(<SonicCanvas isPlaying mode="minimal" />);
    expect(container.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
  });

  it("forwards its ref to the underlying canvas element (added for SonicClipButton)", () => {
    const ref = createRef<HTMLCanvasElement>();
    const { container } = render(<SonicCanvas ref={ref} isPlaying mode="aurora" />);
    expect(ref.current).toBe(container.querySelector("canvas"));
  });
});
