"use client";

import { useId, type CSSProperties, type ReactElement } from "react";
import { formatDuration } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import { lighten } from "@/lib/color";
import { useTrackPeaks } from "@/hooks/use-track-peaks";
import { SeekBar } from "./seek-bar";

/**
 * Waveform seek bar — the real shape of the track, not a straight line.
 *
 * Peaks are computed once per track by `useTrackPeaks` (decode →
 * downsample → normalize) and drawn as two SVG groups: a dim full-track
 * silhouette and a highlighted copy clipped to the played fraction.
 * The actual `<input type="range">` stays on top with a transparent
 * track, so keyboard, touch, screen readers and RTL behaviour are
 * exactly what the plain seek bar already had.
 *
 * Falls back to `SeekBar` whenever peaks aren't available yet (or can
 * never be: no Web Audio, CORS-blocked media, undecodable codec), so
 * this is strictly additive and can't regress playback controls.
 */
export function WaveformSeekBar({
  currentTime,
  duration,
  onSeek,
  audioUrl,
  ambientColor,
  compact = false,
  showRemaining = false,
}: {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  /** Source used to compute the waveform. `null` → plain seek bar. */
  audioUrl: string | null;
  ambientColor?: string;
  compact?: boolean;
  showRemaining?: boolean;
}) {
  const peaks = useTrackPeaks(audioUrl);
  const clipId = useId();
  const { t } = useTranslation();

  if (!peaks || peaks.length === 0) {
    return (
      <SeekBar
        currentTime={currentTime}
        duration={duration}
        onSeek={onSeek}
        ambientColor={ambientColor}
        compact={compact}
        showRemaining={showRemaining}
      />
    );
  }

  const safeDuration = duration || 0;
  const value = Math.min(currentTime, safeDuration || 0);
  const progress = safeDuration > 0 ? (value / safeDuration) * 100 : 0;
  const bucketWidth = 100 / peaks.length;

  const bars: ReactElement[] = peaks.map((peak, i) => {
    const height = 3 + peak * 20;
    return (
      <rect
        key={i}
        x={i * bucketWidth + bucketWidth * 0.2}
        y={12 - height / 2}
        width={bucketWidth * 0.6}
        height={height}
        rx={0.6}
      />
    );
  });

  const style: CSSProperties = { color: ambientColor ?? "rgb(var(--halo-1, 139 92 246))" };
  const seekStyle: CSSProperties = { "--seek-progress": `${progress}%` } as CSSProperties;
  if (ambientColor) {
    Object.assign(seekStyle, {
      "--seek-color-start": ambientColor,
      "--seek-color-end": lighten(ambientColor, 20),
    });
  }

  return (
    <div className="flex w-full items-center gap-2">
      {!compact && (
        <span className="w-11 text-right text-xs tabular-nums text-muted">{formatDuration(value)}</span>
      )}
      <div className="waveform-seek min-w-0 flex-1" style={style}>
        <svg
          aria-hidden="true"
          className="waveform-seek__svg"
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
        >
          <defs>
            <clipPath id={clipId}>
              <rect x="0" y="0" width={Math.max(progress, 0)} height="24" />
            </clipPath>
          </defs>
          <g fill="currentColor" opacity="0.22">
            {bars}
          </g>
          <g fill="currentColor" clipPath={`url(#${clipId})`}>
            {bars}
          </g>
        </svg>
        <input
          type="range"
          min={0}
          max={safeDuration || 1}
          step={0.1}
          value={value}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label={t("player.seek")}
          style={seekStyle}
          className="seek-range seek-range--wave w-full"
        />
      </div>
      {!compact && (
        <span className="w-11 text-xs tabular-nums text-muted">
          {showRemaining ? `-${formatDuration(Math.max(safeDuration - value, 0))}` : formatDuration(safeDuration)}
        </span>
      )}
    </div>
  );
}
