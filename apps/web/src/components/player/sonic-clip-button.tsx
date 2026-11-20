"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Loader2, Video } from "lucide-react";

const CLIP_DURATION_MS = 5000;
const CANDIDATE_MIME_TYPES = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "video/webm";
  }
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "video/webm";
}

/**
 * Feature-detects `canvas.captureStream` + `MediaRecorder` — both are
 * missing on some browsers (older Safari in particular) and always
 * missing in jsdom. Mirrors this codebase's other progressive-
 * enhancement checks (e.g. `useAudioAnalyser`'s Web Audio guard): if the
 * capability isn't there, render nothing rather than a button that would
 * throw the moment it's clicked.
 */
function captureSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function" &&
    typeof window.MediaRecorder !== "undefined"
  );
}

/**
 * Phase 10 stretch goal (flagged as not-done-yet in
 * CHANGES-phase10-sonic-canvas.md's "Not done in this pass" section):
 * export a short capture of the live Sonic Canvas visual as a shareable
 * WebM clip. Reuses `ShareCardButton`'s button/UI pattern — icon button,
 * spinner while working, auto-download on completion — rather than
 * inventing a new interaction, per that section's note.
 *
 * Takes the *already-rendering* canvas via `canvasRef` (see the ref
 * `SonicCanvas` now forwards) and records exactly the pixels it's
 * already drawing every frame — no second canvas, no second draw loop,
 * nothing generated separately from what's on screen.
 */
export function SonicClipButton({
  canvasRef,
  title,
  isPlaying,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  title: string;
  /** Recording a static frame for 5 seconds isn't a useful clip, so the
   *  button stays disabled (not hidden — the capability is still there,
   *  there's just nothing worth capturing yet) while paused. */
  isPlaying: boolean;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Closing the player / navigating away mid-recording stops the
      // in-flight recorder rather than leaving it running (and its
      // `onstop` handler below still fires and downloads whatever was
      // captured so far — the click already happened, so the person
      // still gets a file, just a shorter one than the full 5s).
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    };
  }, []);

  if (!captureSupported()) return null;

  const handleClick = () => {
    const canvas = canvasRef.current;
    if (!canvas || isRecording) return;

    setIsRecording(true);
    try {
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: pickMimeType() });
      recorderRef.current = recorder;
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        if (mountedRef.current) setIsRecording(false);
        if (chunks.length === 0) return;

        const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${title.toLowerCase().replace(/\s+/g, "-")}-melune-clip.webm`;
        link.click();
        URL.revokeObjectURL(url);
      };

      recorder.start();
      setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, CLIP_DURATION_MS);
    } catch {
      // captureStream()/MediaRecorder can still throw at runtime on some
      // browsers despite passing the feature check above (e.g. an
      // unsupported codec combination) — fail silently, the same
      // contract `useAudioAnalyser`'s CORS guard already follows: never
      // break the surrounding player over a decorative extra.
      setIsRecording(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isRecording || !isPlaying}
      title={isPlaying ? "Record a 5-second clip" : "Play a song to record a clip"}
      aria-label={isRecording ? "Recording clip…" : "Download a shareable clip"}
      className="hover:text-foreground disabled:opacity-50"
    >
      {isRecording ? <Loader2 size={20} className="animate-spin" /> : <Video size={20} />}
    </button>
  );
}
