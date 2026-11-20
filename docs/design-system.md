# Design System (Phase 10.1)

> **Naming note:** this doc uses the "Phase 10 / 10.1 / 10.2 / 10.3"
> numbering from the frontend-upgrade plan this pass follows (Sonic
> Canvas → Design System/Ambient Theme → Player polish → Home redesign).
> That's a **different track** from this repo's original canonical
> roadmap, where `docs/architecture.md` already reserves **Phase 10 for
> the mobile app** and **Phase 12 for production deploy/nginx**. Nothing
> here touches `apps/mobile` or `infra/nginx` — this is frontend-web
> polish work that happened to reuse the same phase numbers from a
> separate planning document. Flagging this explicitly here so the two
> numbering tracks don't get confused later.

This is a reference, not a rewrite: every token below already existed
somewhere in the codebase (Tailwind config, `globals.css`, or scattered
inline values found by grep) — this formalizes them into one documented
set and, where useful, gives the scattered values names. It does not
rename or replace any existing usage; new code can adopt the names,
existing code keeps working unchanged.

## Color

Theme-aware surface tokens (`background`, `surface`, `surfaceElevated`,
`foreground`, `muted`, `border`) are CSS variables switched by
`data-theme` on `<html>` — see `globals.css`'s `:root` blocks and
`tailwind.config.ts`'s `colors` section. Defined once, work identically
in light and dark.

Brand colors (`primary` #8B5CF6, `accent` #3B82F6, `ember`) are
**fixed** across both themes on purpose — this is the one visual
constant regardless of light/dark. The extended palette (`teal`,
`rose`, `amber`, `indigo`, `magenta`, `lime`, added Phase 6.6) is for
genre chips / cover-art variety / badges — never for primary CTAs.

### Ambient color (per-track)

Separate from the fixed tokens above: `useAmbientColor` extracts (or
deterministically derives) a color per track. As of this phase, surfaces
should consume it through **`useAmbientTheme`**, not the raw hook
directly — see below.

## Motion

Durations already in use, now also available as named Tailwind classes
(`transitionDuration` in `tailwind.config.ts`) — existing numeric
classes (`duration-500`, etc.) are unchanged, these are additions:

| Name | Value | Existing use |
|---|---|---|
| `quick` | 200ms | `.glass-panel-interactive` hover (`globals.css`) |
| `base` | 300ms | `components/ui/cover.tsx` |
| `slow` | 500ms | `full-screen-player.tsx`, `playlists-panel.tsx` |
| `slower` | 1000ms | `plasma-background.tsx`, `full-screen-player.tsx` |

Named keyframe animations (`tailwind.config.ts`'s `animation` block) —
unchanged, listed here for one place to look:
`heart-burst` (420ms), `play-pulse` (1.6s), `vinyl-spin` (6s),
`visualizer-bar` (900ms — the old CSS visualizer's idle animation, now
mostly superseded by Sonic Canvas, Phase 10), `plasma-drift-a`/`-b`
(22s/28s).

Every animated component should already respect `prefers-reduced-motion`
(see `globals.css`'s media query for `.glass-panel-interactive`, and the
per-component checks in `plasma-background.tsx` / `sonic-canvas.tsx`) —
this doc doesn't change that contract, just names the durations.

## Elevation / shadow

`boxShadow` tokens in `tailwind.config.ts`: `glow`, `glow-sm`, `glow-lg`
(purple glow at three intensities) and `glass` (the drop shadow + inset
highlight every `.glass-panel` uses). No changes — documented as-is.

## Glass surfaces

`.glass-panel` (`globals.css`, Phase 6.5) is the one shared translucent
surface. Three fallback tiers already exist and are unchanged:
lighter blur under 768px width, solid-background fallback under
`@supports not (backdrop-filter)`, and solid fallback under
`prefers-reduced-transparency: reduce`.

## Z-index scale

Also surveyed via grep — every current z-index value already forms a
clean 10-step scale; it just wasn't named until now. Added as
`zIndex` tokens in `tailwind.config.ts`, existing numeric classes
(`z-30`, `z-[70]`, ...) untouched:

| Name | Value | Existing use |
|---|---|---|
| `sticky` | 10 | `topbar.tsx`, `app-shell.tsx`'s ambient wash, `plasma-background.tsx` |
| `panel` | 20 | `sidebar.tsx`; `.glass-panel:focus-within` |
| `menu` | 30 | `user-menu.tsx`, `song-more-menu.tsx`, `persistent-player.tsx` |
| `overlay` | 40 | `bottom-nav.tsx`, `queue-panel.tsx`, `admin/layout.tsx` |
| `player` | 50 | `full-screen-player.tsx` |
| `modal` | 60 | `playlist-form-dialog.tsx`, `shortcuts-help-dialog.tsx`, `admin/modal.tsx` |
| `palette` | 70 | `command-palette.tsx`, `landing-gate.tsx` |
| `skip` | 80 | `app-shell.tsx`'s skip-to-content link |

## Typography

`fontFamily` tokens: `display` (Sora, headings/logo/big numbers),
`sans` (body copy, Latin), `fa` (Vazirmatn, explicit Persian). Both
`display` and `sans` already fall back through `--font-fa` so mixed
fa/en strings never drop to the system font mid-sentence. Unchanged.

## Spacing / radius

Standard Tailwind spacing scale (unchanged). `borderRadius` extends:
`xl` (1rem), `2xl` (1.5rem) — the two most common panel/card radii,
already in use.

---

## Ambient Theme Engine

Formalizes what was, before this phase, two independent
`useAmbientColor(coverUrl, seed)` calls (`full-screen-player.tsx` and
`app-shell.tsx`) with no user control and no contrast guardrail, into
one pipeline:

```
Album artwork
  → useAmbientColor (extraction; unchanged, Phase 6/8)
  → mode gate           (useAmbientTheme + ambient-theme-store.ts)
  → contrast-safety clamp (ambient-color-utils.ts)
  → limited named surfaces:
       - full-screen player backdrop (PlasmaBackground)
       - Sonic Canvas (Phase 10)
       - seek bar fill gradient
       - app-wide ambient wash (AppShell)
```

### Modes

Persisted in `ambient-theme-store.ts` (same shape/pattern as
`theme-store.ts`'s light/dark toggle), cycled via the topbar's new
`AmbientModeToggle` (next to `ThemeToggle`):

- **Dynamic** (default) — today's existing per-track tinting, now
  contrast-clamped.
- **Static** — ambient tinting off; every surface above uses the fixed
  brand color (`#8B5CF6`) instead, returned *unclamped* since it's
  already the same known-safe color used elsewhere in the UI.
- **System** — behaves like Dynamic, except when the OS reports
  `prefers-contrast: more`, where it behaves like Static for that
  session. There's no OS signal for "prefers a calmer music UI" the way
  there is for light/dark — this is deliberately scoped to the one real
  accessibility signal that applies, not a broader guess.

### Contrast-safety clamp

`ambient-color-utils.ts`'s `toSafeAmbientColor` clamps saturation to
42–90% and lightness to 32–62% (hue is never touched — hue is what
makes a color "this track's," never what causes a contrast problem).
Reuses `lib/color.ts`'s existing `parseColor`/`hslToRgb` (already built
for the seek-bar gradient) rather than a second parser — briefly
duplicated during this phase's first draft, corrected before landing.

Never applied to body text, borders carrying text, or anywhere else
WCAG AA contrast would be at risk — only the four surfaces listed above,
all of which were already using the unclamped raw color before this
phase.


### AMOLED mode (4th ambient mode)

`"amoled"` pins the brand color like Static, forces the dark theme, and
sets `<html data-amoled="true">`, which `globals.css` maps to a true-black
background (`0 0 0`) with surfaces a few steps above it. Applied before
hydration by a no-flash script in `layout.tsx`.

### What's intentionally not built yet

- No admin/user-facing control over the clamp band itself — it's a
  fixed constant, not a setting.
- "System" mode's scope is limited to `prefers-contrast`, as above; it
  does not also fold in `prefers-reduced-transparency` (that's already
  handled independently by `.glass-panel`'s own fallback) or
  `prefers-reduced-motion` (already handled per-component, e.g.
  `sonic-canvas.tsx`, `plasma-background.tsx`).
