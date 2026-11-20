/**
 * Target time for a "skip N seconds" button: current time + delta, kept
 * inside [0, duration]. When the duration isn't known yet (0) only the
 * lower bound applies — the <audio> element clamps the upper one itself.
 */
export function seekBy(currentTime: number, delta: number, duration: number): number {
  const max = duration > 0 ? duration : Number.POSITIVE_INFINITY;
  return Math.min(Math.max(currentTime + delta, 0), max);
}
