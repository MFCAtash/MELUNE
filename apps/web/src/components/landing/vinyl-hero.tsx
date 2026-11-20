/** Pure-CSS record — the landing page's one memorable element. It echoes
 *  the vinyl in the full-screen player, so the promise matches the product. */
export function VinylHero() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm sm:max-w-md" aria-hidden>
      <div className="absolute -inset-8 rounded-full bg-primary/20 blur-3xl" />
      <div className="animate-vinyl-spin relative h-full w-full rounded-full shadow-2xl ring-1 ring-white/10">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "repeating-radial-gradient(circle at center, #0A0A0F 0px, #0A0A0F 2px, #171722 2px, #171722 4px)",
          }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 20deg, transparent 0 18%, rgba(255,255,255,0.10) 25%, transparent 32% 68%, rgba(255,255,255,0.10) 75%, transparent 82%)",
          }}
        />
        <div className="bg-codex-gradient absolute inset-[33%] rounded-full ring-4 ring-black/40" />
        <div className="absolute inset-[48.5%] rounded-full bg-background ring-2 ring-black/60" />
      </div>
    </div>
  );
}
