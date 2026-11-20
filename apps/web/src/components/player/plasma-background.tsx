/**
 * Plasma UI (item 8, phase 8) — a purely decorative, ambient-light
 * effect: two large, heavily blurred gradient blobs that slowly drift.
 *
 * Three intensities share one implementation:
 * - "full" (default): the original phase 8.1 scope — inside the
 *   full-screen player's backdrop only, desktop only (`hidden lg:block`),
 *   at full opacity. Nothing about this mode changed.
 * - "ambient" (phase 8.2): a much fainter (10-15% opacity) instance
 *   fixed behind the *entire* app shell, on every breakpoint, so the
 *   whole app — not just the full-screen player — carries a soft wash
 *   of the current track's color.
 * - "page" (Phase 10.1 follow-up): sits behind a single page-header
 *   block (artist/album pages) rather than the full-screen player or
 *   the whole app shell. Unlike "ambient" it is NOT `fixed` — it's
 *   `absolute inset-0`, meant to fill a `relative isolate overflow-hidden`
 *   container the caller provides (so it can't bleed outside that
 *   header), and it renders on every breakpoint (not `lg:block`-gated
 *   like "full", since a page header has no separate mobile layout to
 *   protect the way the full-screen player's desktop-only backdrop
 *   does). Opacity sits between the other two: present enough to read
 *   as "this page is tinted by the artist/album art," faint enough to
 *   never compete with the heading text or cover art in front of it.
 *
 * All three intensities keep the same accessibility guarantees, which
 * must never be weakened:
 * - `aria-hidden` + `pointer-events-none`: it's ambient light, not
 *   content or a control.
 * - Gated on `prefers-reduced-motion`: the blobs render as a static
 *   gradient by default and only pick up motion under
 *   `motion-safe:*`, so anyone with reduced-motion set (OS-level)
 *   never sees animation, no separate JS check needed.
 */
export function PlasmaBackground({
  color = "#8B5CF6",
  intensity = "full",
}: {
  color?: string;
  /** "full" = original full-screen-player backdrop (desktop only, bold).
   *  "ambient" = faint, app-wide wash behind the whole shell.
   *  "page" = contained wash behind a single page-header block. */
  intensity?: "ambient" | "full" | "page";
}) {
  const isAmbient = intensity === "ambient";
  const isPage = intensity === "page";

  return (
    <div
      aria-hidden
      className={
        isAmbient
          ? "pointer-events-none fixed inset-0 -z-10 overflow-hidden"
          : isPage
            ? "pointer-events-none absolute inset-0 -z-10 overflow-hidden"
            : "pointer-events-none absolute inset-0 hidden overflow-hidden lg:block"
      }
    >
      <div
        className={`motion-safe:animate-plasma-drift-a absolute left-1/4 top-1/3 h-[42rem] w-[42rem] rounded-full blur-[110px] transition-[background] duration-1000 ease-out ${
          isAmbient ? "opacity-[0.12]" : isPage ? "opacity-20" : "opacity-30"
        }`}
        style={{ background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }}
      />
      <div
        className={`motion-safe:animate-plasma-drift-b absolute right-1/4 bottom-1/4 h-[36rem] w-[36rem] rounded-full blur-[110px] transition-[background] duration-1000 ease-out ${
          isAmbient ? "opacity-[0.1]" : isPage ? "opacity-[0.16]" : "opacity-25"
        }`}
        style={{
          background:
            isAmbient || isPage
              ? `radial-gradient(circle, ${color} 0%, transparent 70%)`
              : "radial-gradient(circle, #3B82F6 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
