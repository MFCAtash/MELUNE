/**
 * Empty-state illustrations — small, brand-consistent SVG glyphs for
 * `<EmptyState illustration={...}>`.
 *
 * One shared shell (a soft blurred color blob behind a glass-panel
 * circle, matching this project's existing `.glass-panel` surface —
 * see docs/design-system.md) plus a distinct hand-drawn glyph per
 * empty-state "kind", each colored from the extended palette
 * (`tailwind.config.ts`'s teal/rose/amber/indigo/lime — reserved for
 * exactly this kind of variety, never primary CTAs) so the different
 * empty states stay visually distinguishable at a glance rather than
 * all reading as one generic "nothing here" icon.
 *
 * Purely decorative: every root SVG is `aria-hidden`, since the
 * heading + description text next to it already carries the meaning
 * (same reasoning `SonicCanvas` and `PlasmaBackground` already use for
 * their own `aria-hidden` ambient visuals).
 */

const PALETTE = {
  primary: "#8B5CF6",
  accent: "#3B82F6",
  teal: "#14B8A6",
  rose: "#F43F5E",
  amber: "#F59E0B",
  indigo: "#6366F1",
  lime: "#84CC16",
} as const;

function IllustrationShell({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div aria-hidden className="relative mb-2 flex h-24 w-24 items-center justify-center">
      <div
        className="absolute inset-0 rounded-full opacity-25 blur-xl"
        style={{ background: color }}
      />
      <div
        className="glass-panel relative flex h-20 w-20 items-center justify-center !rounded-full"
        style={{ color }}
      >
        {children}
      </div>
    </div>
  );
}

/** "No liked songs yet" */
export function EmptyLikesIllustration() {
  return (
    <IllustrationShell color={PALETTE.rose}>
      <svg viewBox="0 0 40 40" width="34" height="34" fill="none">
        <path
          d="M20 30.5c-.6 0-1.1-.2-1.6-.6-4.2-3.7-7-6.4-8.8-8.7-1.8-2.3-2.6-4.3-2.6-6.4 0-3.7 2.9-6.6 6.6-6.6 2.1 0 4.1 1 5.4 2.6l1 1.2 1-1.2c1.3-1.6 3.3-2.6 5.4-2.6 3.7 0 6.6 2.9 6.6 6.6 0 2.1-.8 4.1-2.6 6.4-1.8 2.3-4.6 5-8.8 8.7-.5.4-1 .6-1.6.6Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M16 17.5h2.4l1.4-2.8 2 5.6 1.2-2.8H26" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </IllustrationShell>
  );
}

/** Empty playlist (owner view) / start-your-first-playlist */
export function EmptyPlaylistIllustration() {
  return (
    <IllustrationShell color={PALETTE.primary}>
      <svg viewBox="0 0 40 40" width="34" height="34" fill="none">
        <rect x="8" y="9" width="24" height="4" rx="2" fill="currentColor" opacity="0.9" />
        <rect x="8" y="17" width="18" height="4" rx="2" fill="currentColor" opacity="0.65" />
        <rect x="8" y="25" width="12" height="4" rx="2" fill="currentColor" opacity="0.4" />
        <circle cx="30" cy="27" r="5.5" fill="currentColor" />
        <path d="M30 24v6M27 27h6" stroke="var(--color-surface, #14131a)" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </IllustrationShell>
  );
}

/** Saved albums */
export function EmptyAlbumsIllustration() {
  return (
    <IllustrationShell color={PALETTE.amber}>
      <svg viewBox="0 0 40 40" width="34" height="34" fill="none">
        <rect x="7" y="11" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
        <circle cx="16" cy="20" r="4" stroke="currentColor" strokeWidth="2" />
        <circle cx="16" cy="20" r="1.1" fill="currentColor" />
        <rect x="22" y="7" width="11" height="11" rx="2.5" fill="currentColor" opacity="0.35" />
      </svg>
    </IllustrationShell>
  );
}

/** Saved artists */
export function EmptyArtistsIllustration() {
  return (
    <IllustrationShell color={PALETTE.indigo}>
      <svg viewBox="0 0 40 40" width="34" height="34" fill="none">
        <circle cx="20" cy="15" r="6" stroke="currentColor" strokeWidth="2" />
        <path
          d="M9 32c0-5.5 4.9-10 11-10s11 4.5 11 10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M28 24.5c3.6.9 6 3.8 6 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
      </svg>
    </IllustrationShell>
  );
}

/** Search — no query typed yet */
export function EmptySearchPromptIllustration() {
  return (
    <IllustrationShell color={PALETTE.accent}>
      <svg viewBox="0 0 40 40" width="34" height="34" fill="none">
        <circle cx="17" cy="17" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M23.5 23.5 31 31" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path
          d="M13.5 17.5c.4-3 1.8-4.6 3.8-4.6M17 20.6h.01"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.6"
        />
      </svg>
    </IllustrationShell>
  );
}

/** Search — query typed, nothing matched */
export function EmptySearchResultsIllustration() {
  return (
    <IllustrationShell color={PALETTE.accent}>
      <svg viewBox="0 0 40 40" width="34" height="34" fill="none">
        <circle cx="17" cy="17" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M23.5 23.5 31 31" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M13.5 17.5 20.5 17.5M17 14l0 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" transform="rotate(45 17 17.5)" />
      </svg>
    </IllustrationShell>
  );
}

/** Generic "the catalog / feed is empty" (no content exists yet) */
export function EmptyCatalogIllustration() {
  return (
    <IllustrationShell color={PALETTE.lime}>
      <svg viewBox="0 0 40 40" width="34" height="34" fill="none">
        <path d="M14 27V11l16-3v16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="11.5" cy="27" r="3.5" stroke="currentColor" strokeWidth="2" />
        <circle cx="27" cy="24.5" r="3.5" stroke="currentColor" strokeWidth="2" />
      </svg>
    </IllustrationShell>
  );
}

/** Network / load error ("couldn't load…") — distinct from "empty on purpose" */
export function ErrorIllustration() {
  return (
    <IllustrationShell color={PALETTE.teal}>
      <svg viewBox="0 0 40 40" width="34" height="34" fill="none">
        <path
          d="M12 24a6 6 0 0 1 1-11.9A8 8 0 0 1 28 14a5.5 5.5 0 0 1 .5 11"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.55"
        />
        <path d="M9 9 31 31" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </IllustrationShell>
  );
}

/** "Playlist not found" (deleted / private) */
export function NotFoundIllustration() {
  return (
    <IllustrationShell color={PALETTE.rose}>
      <svg viewBox="0 0 40 40" width="34" height="34" fill="none">
        <circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="2" />
        <path
          d="M17 16.3a3 3 0 1 1 4.4 2.6c-1.1.6-1.6 1.2-1.6 2.4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="19.9" cy="25" r="1.3" fill="currentColor" />
      </svg>
    </IllustrationShell>
  );
}
