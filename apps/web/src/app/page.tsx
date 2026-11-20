import Link from "next/link";
import { LandingGate } from "@/components/landing/landing-gate";
import { TrendingPreview } from "@/components/landing/trending-preview";
import { VinylHero } from "@/components/landing/vinyl-hero";

const FEATURES = [
  {
    title: "Mixes built from your listening",
    body: "Play a few songs and Made for you fills in with tracks from the genres you return to most.",
  },
  {
    title: "Playlists that stay yours",
    body: "Create, reorder and save playlists and albums. Everything lives in one library.",
  },
  {
    title: "A player that keeps up",
    body: "Music keeps playing while you browse. Open the full-screen player for the vinyl view and ambient colour.",
  },
];

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background pb-32">
      <LandingGate />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="brand-wordmark font-brand text-lg font-semibold">
          MELUNE
        </span>
        <nav aria-label="Account" className="flex items-center gap-2">
          <Link href="/login" className="rounded-full px-4 py-2 text-sm text-foreground hover:text-primary">
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-full border border-border px-4 py-2 text-sm text-foreground hover:border-primary"
          >
            Sign up
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-12 lg:grid-cols-2 lg:py-20">
        <div>
          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            Your music,
            <br />
            smarter.
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted">
            Stream, save and rediscover songs. The more you play, the better MELUNE gets at
            building mixes that sound like you.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="bg-codex-gradient rounded-xl px-6 py-3 font-medium text-white shadow-glow"
            >
              Create free account
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-border px-6 py-3 font-medium text-foreground hover:border-primary"
            >
              Log in
            </Link>
          </div>
        </div>
        <VinylHero />
      </section>

      <section className="mx-auto max-w-6xl px-6">
        <TrendingPreview />
      </section>

      <section className="mx-auto mt-20 grid max-w-6xl gap-10 border-t border-border px-6 pt-12 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title}>
            <h2 className="text-lg font-semibold text-foreground">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
