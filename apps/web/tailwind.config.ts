import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        // Headings/logo/big numbers.
        display: ["var(--font-display)", "var(--font-fa)", "sans-serif"],
        // Body copy (Latin). Falls back to Vazirmatn so mixed fa/en
        // strings never drop to the system font mid-sentence.
        sans: ["var(--font-sans)", "var(--font-fa)", "sans-serif"],
        // Explicit Persian family for [dir="rtl"] overrides.
        fa: ["var(--font-fa)", "var(--font-sans)", "sans-serif"],
        // MELUNE brand voice — the poetic serif wordmark font (see
        // layout.tsx / .brand-wordmark in globals.css). UI text never
        // uses this; it's reserved for the logo and brand moments.
        brand: ["var(--font-brand)", "var(--font-display)", "serif"],
      },
      colors: {
        // Theme-aware tokens (Phase 6.7): CSS variables switched by
        // `data-theme` on <html> (see globals.css + store/theme-store.ts),
        // default values below match dark mode so nothing regresses if
        // the variables are ever missing. The `<alpha-value>` placeholder
        // lets Tailwind opacity modifiers (`bg-surface/80` etc, already
        // used across the app) keep working against a CSS var.
        background: "rgb(var(--color-background) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        surfaceElevated: "rgb(var(--color-surface-elevated) / <alpha-value>)",
        foreground: "rgb(var(--color-foreground) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        border: "rgb(var(--color-border-rgb) / 0.5)",
        // Brand accents are theme-aware too: classic shells inherit the
        // original purple/blue defaults, signature themes override the
        // variables (see globals.css) so active nav, links, play buttons
        // and glow shadows follow the theme's own palette.
        primary: {
          DEFAULT: "rgb(var(--color-primary) / <alpha-value>)",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "rgb(var(--color-accent) / <alpha-value>)",
          foreground: "#FFFFFF",
        },
        // Secondary accent, reserved for share cards / rewind-style
        // moments where the brand gradient alone would be flat.
        ember: {
          DEFAULT: "#FF6A3D",
          dim: "#D6502A",
        },
        // Extended palette (Phase 6.6): named tokens for genre chips,
        // cover-art variety and badges, so those surfaces stop reusing
        // the purple→blue brand pair everywhere. Not used for primary
        // CTAs — those stay on `primary`/`accent` for brand consistency.
        teal: { DEFAULT: "#14B8A6", dim: "#0F9488" },
        rose: { DEFAULT: "#F43F5E", dim: "#C22C46" },
        amber: { DEFAULT: "#F59E0B", dim: "#B4770A" },
        indigo: { DEFAULT: "#6366F1", dim: "#4A4DDB" },
        magenta: { DEFAULT: "#D946EF", dim: "#AA21C2" },
        lime: { DEFAULT: "#84CC16", dim: "#5F9110" },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      // Phase 10.1 — Design System tokens. Named after durations/z-index
      // values already in use across the app (surveyed via grep, not
      // invented) so `duration-slow`/`z-modal` etc. are available for new
      // code going forward. Existing numeric classes (`duration-500`,
      // `z-30`, ...) are untouched and keep working exactly as before —
      // this only adds names, it doesn't rename anything.
      transitionDuration: {
        quick: "200ms", // .glass-panel-interactive hover (globals.css)
        base: "300ms", // components/ui/cover.tsx
        slow: "500ms", // full-screen-player.tsx, playlists-panel.tsx
        slower: "1000ms", // plasma-background.tsx, full-screen-player.tsx
      },
      zIndex: {
        sticky: "10", // topbar.tsx, app-shell.tsx, plasma-background.tsx
        panel: "20", // sidebar.tsx; also glass-panel:focus-within (globals.css)
        menu: "30", // user-menu.tsx, song-more-menu.tsx, persistent-player.tsx
        overlay: "40", // bottom-nav.tsx, queue-panel.tsx, admin/layout.tsx
        player: "50", // full-screen-player.tsx
        modal: "60", // playlist-form-dialog.tsx, shortcuts-help-dialog.tsx, admin/modal.tsx
        palette: "70", // command-palette.tsx, landing-gate.tsx
        skip: "80", // app-shell.tsx's skip-to-content link
      },
      backgroundImage: {
        "codex-gradient": "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
        // Soft ambient light behind the whole app shell (fixed, decorative).
        "app-glow":
          "radial-gradient(60rem 40rem at 85% -10%, rgba(139, 92, 246, 0.22), transparent 60%), radial-gradient(50rem 36rem at 0% 35%, rgba(59, 130, 246, 0.14), transparent 60%)",
        // Bottom scrim so text stays readable on top of artwork.
        "cover-scrim": "linear-gradient(to top, rgba(10, 10, 15, 0.92) 0%, rgba(10, 10, 15, 0.35) 55%, transparent 100%)",
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(139, 92, 246, 0.45)",
        "glow-sm": "0 0 20px -6px rgba(139, 92, 246, 0.55)",
        "glow-lg": "0 0 70px -12px rgba(139, 92, 246, 0.55)",
        glass: "0 10px 40px -12px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
      },
      keyframes: {
        heartBurst: {
          "0%": { transform: "scale(1)" },
          "35%": { transform: "scale(1.4)" },
          "60%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)" },
        },
        playPulse: {
          "0%": { boxShadow: "0 0 0 0 rgba(139, 92, 246, 0.45)" },
          "100%": { boxShadow: "0 0 0 14px rgba(139, 92, 246, 0)" },
        },
        vinylSpin: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        visualizerBar: {
          "0%, 100%": { height: "20%" },
          "50%": { height: "90%" },
        },
        // Phase 8: Plasma UI — slow organic drift for the full-screen
        // player's desktop backdrop only (see plasma-background.tsx).
        // Two different periods/paths per blob keep it from reading as
        // a single pulsing blob.
        plasmaDriftA: {
          "0%, 100%": { transform: "translate(-8%, -6%) scale(1)" },
          "33%": { transform: "translate(6%, 4%) scale(1.15)" },
          "66%": { transform: "translate(-4%, 8%) scale(0.9)" },
        },
        plasmaDriftB: {
          "0%, 100%": { transform: "translate(6%, 8%) scale(1)" },
          "50%": { transform: "translate(-10%, -4%) scale(1.2)" },
        },
      },
      animation: {
        "heart-burst": "heartBurst 420ms ease-out",
        "play-pulse": "playPulse 1.6s ease-out infinite",
        "vinyl-spin": "vinylSpin 6s linear infinite",
        "visualizer-bar": "visualizerBar 900ms ease-in-out infinite",
        "plasma-drift-a": "plasmaDriftA 22s ease-in-out infinite",
        "plasma-drift-b": "plasmaDriftB 28s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
