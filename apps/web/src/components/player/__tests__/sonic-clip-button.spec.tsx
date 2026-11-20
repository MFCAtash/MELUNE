import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useRef } from "react";
import { SonicClipButton } from "../sonic-clip-button";

/** Minimal stand-in for the browser's `MediaRecorder` — jsdom has none at
 *  all, so every test that needs "supported" behaviour installs this on
 *  `window` first. `stop()` synchronously fires `ondataavailable` then
 *  `onstop`, matching real recorders closely enough for this component's
 *  purposes (it only reacts to those two callbacks). */
class MockMediaRecorder {
  static isTypeSupported = vi.fn().mockReturnValue(true);
  state: "inactive" | "recording" = "inactive";
  mimeType = "video/webm";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  start() {
    this.state = "recording";
  }

  stop() {
    if (this.state !== "recording") return;
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["frame"]) });
    this.onstop?.();
  }
}

const stopTrack = vi.fn();
const captureStream = vi.fn().mockReturnValue({ getTracks: () => [{ stop: stopTrack }] });

/** Patches the two capabilities `captureSupported()` checks for, plus the
 *  `URL`/anchor-click plumbing the download path uses — none of which
 *  jsdom implements. Every patch is `configurable: true` so `afterEach`
 *  below can remove it and the "unsupported" test keeps working across
 *  the whole file, not just when it happens to run first. */
function mockCaptureSupport() {
  // `afterEach` calls vi.restoreAllMocks(), which can clear the return value
  // of module-level vi.fn() mocks between tests — re-seed it every time so
  // each test is self-contained.
  captureStream.mockReturnValue({ getTracks: () => [{ stop: stopTrack }] });
  Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", {
    value: captureStream,
    configurable: true,
  });
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  Object.defineProperty(URL, "createObjectURL", {
    value: vi.fn().mockReturnValue("blob:mock"),
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
}

/** Renders a real `<canvas>` alongside the button, wired together the
 *  same way `FullScreenPlayer` wires `SonicCanvas`'s forwarded ref to
 *  this button's `canvasRef` prop — the component under test only ever
 *  reads `canvasRef.current`, never the `<SonicCanvas>` component itself. */
function TestHarness({ isPlaying = true }: { isPlaying?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  return (
    <>
      <canvas ref={canvasRef} />
      <SonicClipButton canvasRef={canvasRef} title="Midnight Drive" isPlaying={isPlaying} />
    </>
  );
}

describe("SonicClipButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // @ts-expect-error — test-only prototype patch, not part of the real DOM lib types
    delete HTMLCanvasElement.prototype.captureStream;
    // @ts-expect-error — same, for the URL patches
    delete URL.createObjectURL;
    // @ts-expect-error — same
    delete URL.revokeObjectURL;
  });

  it("renders nothing when captureStream/MediaRecorder aren't supported (jsdom's default)", () => {
    const { container } = render(<TestHarness />);
    expect(container.querySelector("button")).not.toBeInTheDocument();
  });

  it("renders a disabled button while paused, once capture is supported", () => {
    mockCaptureSupport();
    render(<TestHarness isPlaying={false} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("records the currently-drawing canvas and downloads a clip on click", () => {
    vi.useFakeTimers();
    mockCaptureSupport();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<TestHarness isPlaying />);
    const button = screen.getByRole("button");

    fireEvent.click(button);
    expect(captureStream).toHaveBeenCalledWith(30);
    expect(button).toBeDisabled(); // now recording — the same button, not a second state

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(stopTrack).toHaveBeenCalled(); // captured MediaStream tracks are released, not left open
    expect(button).not.toBeDisabled(); // back to idle once the download fires

    vi.useRealTimers();
  });
});
