/** Minimal LRC (LRC 1.2 / "enhanced" word timings) parser.
 *
 * Kept deliberately dependency-free and total: malformed lines are skipped
 * rather than throwing, so an imperfect fan-uploaded file can still yield
 * the lines that are usable.
 */
export interface ParsedLyricLine {
  timeSeconds: number;
  text: string;
}

const TIME_TAG = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const META_TAG = /^\s*\[[a-zA-Z]+:/;

function fractionToSeconds(raw: string | undefined): number {
  if (!raw) return 0;
  // LRC uses either hundredths (.50) or thousandths (.500).
  const denom = raw.length === 1 ? 10 : raw.length === 2 ? 100 : 1000;
  return Number(raw) / denom;
}

export function parseLrc(input: string): ParsedLyricLine[] {
  if (typeof input !== "string" || input.length === 0) return [];
  const lines: ParsedLyricLine[] = [];

  for (const rawLine of input.split(/\r?\n/)) {
    if (META_TAG.test(rawLine)) continue; // [ar:…], [ti:…], [offset:…]
    const tags = [...rawLine.matchAll(TIME_TAG)];
    if (tags.length === 0) continue;

    // Strip timestamp tags and enhanced word-timing tags (<00:12.34>)
    // while keeping the actual words in their original language.
    const text = rawLine
      .replace(TIME_TAG, "")
      .replace(/<[^>]*>/g, "")
      .trim();
    if (!text) continue;

    for (const tag of tags) {
      const minutes = Number(tag[1]);
      const seconds = Number(tag[2]);
      const timeSeconds = minutes * 60 + seconds + fractionToSeconds(tag[3]);
      lines.push({ timeSeconds, text });
    }
  }

  return lines.sort((a, b) => a.timeSeconds - b.timeSeconds);
}
