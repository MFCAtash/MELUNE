export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** "1 hr 12 min" / "48 min" — for playlist and album totals. */
export function formatTotalDuration(totalSeconds: number): string {
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${Math.max(totalMinutes, 1)} min`;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

/** Compact play counts: 950 → "950", 12_400 → "12K", 3_200_000 → "3.2M". */
export function formatCount(n: number, locale = "en"): string {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
