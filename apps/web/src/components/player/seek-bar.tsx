"use client";

import type { CSSProperties } from "react";
import { formatDuration } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import { lighten } from "@/lib/color";

export function SeekBar({
  currentTime,
  duration,
  onSeek,
  compact = false,
  showRemaining = false,
  ambientColor,
}: {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  compact?: boolean;
  /** Show "-m:ss" (time left) on the end side instead of the total length. */
  showRemaining?: boolean;
  /** Track's ambient color (see useAmbientColor). Drives the fill gradient;
   *  omitted falls back to the static brand purple/pink in globals.css. */
  ambientColor?: string;
}) {
  const safeDuration = duration || 0;
  const value = Math.min(currentTime, safeDuration || 0);
  const progress = safeDuration > 0 ? (value / safeDuration) * 100 : 0;
  const { t } = useTranslation();

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
      <input
        type="range"
        min={0}
        max={safeDuration || 1}
        step={0.1}
        value={value}
        onChange={(e) => onSeek(Number(e.target.value))}
        aria-label={t("player.seek")}
        style={seekStyle}
        className="seek-range min-w-0 flex-1"
      />
      {!compact && (
        <span className="w-11 text-xs tabular-nums text-muted">
          {showRemaining ? `-${formatDuration(Math.max(safeDuration - value, 0))}` : formatDuration(safeDuration)}
        </span>
      )}
    </div>
  );
}
