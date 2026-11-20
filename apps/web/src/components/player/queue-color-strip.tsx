"use client";

import { useMemo } from "react";
import { usePlayerStore } from "@/store/player-store";
import { useTranslation } from "@/hooks/use-translation";
import { useQueueColors } from "@/hooks/use-queue-colors";
import { buildQueueStrip, stripProgress } from "@/lib/queue-strip";

/** Live fill of the current segment. Split out so the 4×/s `currentTime`
 *  ticks re-render only this <span>, not the whole strip (and never
 *  re-run the color work). */
function CurrentFill({ color }: { color: string }) {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  return (
    <span
      className="block h-full rounded-full"
      style={{ width: `${stripProgress(currentTime, duration) * 100}%`, backgroundColor: color }}
    />
  );
}

/**
 * A thin horizontal bar previewing the "mood" of what plays next: one
 * segment per upcoming track, tinted with that track's real ambient color
 * (the same artwork → color pipeline the player already runs — see
 * `useQueueColors`), so a warm/cool/energetic run of songs is visible
 * without opening the queue.
 *
 * Segment widths follow track length. The current track's segment fills
 * with playback progress; the couple of tracks before it stay as dim
 * segments so the bar reads as a position in the queue. A faint cap at the
 * end means more tracks are queued beyond the window.
 *
 * Purely informational (not focusable, not clickable) — the queue panel
 * remains the one place to act on the queue. Renders nothing until there
 * is at least one upcoming track.
 */
export function QueueColorStrip({
  size = "sm",
  className = "",
}: {
  /** "sm" = 3px hairline (player bar edge). "md" = 6px (inside panels). */
  size?: "sm" | "md";
  className?: string;
}) {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const { t } = useTranslation();

  const model = useMemo(() => buildQueueStrip(queue, currentIndex), [queue, currentIndex]);
  const colors = useQueueColors(model.segments.map((segment) => segment.song));

  if (model.upcomingCount === 0) return null;

  return (
    <div
      role="img"
      aria-label={t("queue.colorPreview")}
      data-testid="queue-color-strip"
      className={`flex w-full items-stretch gap-[2px] ${size === "md" ? "h-1.5" : "h-[3px]"} ${className}`}
    >
      {model.segments.map((segment, i) => {
        const color = colors[i];
        const transition = "motion-safe:transition-[background-color,opacity] motion-safe:duration-700";

        if (segment.state === "current") {
          return (
            <span
              key={`${segment.song.id}-${segment.index}`}
              data-segment="current"
              className={`overflow-hidden rounded-full bg-white/15 ${transition}`}
              style={{ flex: `${segment.weight} 1 0%` }}
            >
              <CurrentFill color={color} />
            </span>
          );
        }

        return (
          <span
            key={`${segment.song.id}-${segment.index}`}
            data-segment={segment.state}
            className={`rounded-full ${transition}`}
            style={{
              flex: `${segment.weight} 1 0%`,
              backgroundColor: color,
              opacity: segment.state === "played" ? 0.3 : 0.85,
            }}
          />
        );
      })}
      {model.hiddenUpcoming > 0 && (
        <span data-segment="more" className="w-2 shrink-0 rounded-full bg-white/25" />
      )}
    </div>
  );
}
