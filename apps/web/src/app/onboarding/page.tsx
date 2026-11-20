"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, X, Check } from "lucide-react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
// Project's own reduced-motion hook, not framer-motion's built-in
// `useReducedMotion` — see media-card.tsx's comment (jsdom has no
// `window.matchMedia`, which framer-motion's version calls
// unconditionally and would break this page's tests).
import { useMediaQuery } from "@/hooks/use-media-query";
import { useGenres } from "@/lib/queries";
import { setOnboardingGenreIds, skipOnboarding } from "@/lib/onboarding";
import { safeRedirect } from "@/lib/nav";
import { coverGradient } from "@/lib/cover";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/shell/logo";

const MIN_PICKS = 3;
const MAX_PICKS = 5;
const SWIPE_OFFSET_THRESHOLD = 120;
const SWIPE_VELOCITY_THRESHOLD = 600;
const FLY_OUT_DISTANCE = 520;
// Matches full-screen-player.tsx's shared-element transition spring —
// this project doesn't have a shared motion-presets module (each
// component keeps its own small spring constant, e.g. media-card.tsx's
// `cardSpring`), so this follows that same convention rather than
// introducing a new shared file just for this one addition.
const deckSpring = { type: "spring", stiffness: 300, damping: 32 } as const;

type Direction = "like" | "skip";

/** `AnimatePresence`'s `custom` prop is specifically for this: it's
 *  threaded to the `exit` variant of a child that's already being
 *  removed, not just to children still in the tree — which is what
 *  lets the *outgoing* card animate toward whichever direction was
 *  actually swiped/tapped, decided the same render that removes it. */
const cardVariants = {
  enter: { scale: 0.94, opacity: 0, x: 0, rotate: 0 },
  center: { scale: 1, opacity: 1, x: 0, rotate: 0 },
  exit: (direction: 1 | -1) => ({
    x: direction * FLY_OUT_DISTANCE,
    rotate: direction * 14,
    opacity: 0,
  }),
};

/**
 * Shown once, right after signup (see register/page.tsx). There's no
 * `/users/me/preferences` endpoint yet, so picks are stored client-side
 * (lib/onboarding.ts) and used only as a fallback seed for "Made for
 * you" until real listening history exists — see
 * queries.ts#useOnboardingSeedSongs. That storage contract is
 * unchanged; only the picking *interaction* is new here — a one-card-
 * at-a-time swipe deck (drag right to like, left to skip) instead of a
 * static grid of toggle chips, using the same spring physics as
 * `MediaCard`'s hover/press feedback so it feels like one motion
 * language across the app, not a one-off gimmick.
 *
 * Dragging is a bonus, not the only way through: every card also has
 * plain Like/Skip buttons, since a drag gesture alone isn't operable
 * from a keyboard and this project treats that as a hard requirement
 * everywhere else (see docs/design-system.md's a11y notes).
 */
export default function OnboardingPage() {
  const router = useRouter();
  const genres = useGenres();
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const [deckIndex, setDeckIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exitDirection, setExitDirection] = useState<1 | -1>(1);

  // Plain `window.location.search` rather than `useSearchParams()` —
  // matches register/page.tsx, and keeps this page out of a Suspense
  // boundary (it's "use client" and per-user already, so Next's
  // static-prerender warning for the hook doesn't buy anything here).
  const destination =
    typeof window !== "undefined"
      ? safeRedirect(new URLSearchParams(window.location.search).get("next"))
      : "/home";

  const genreList = genres.data ?? [];
  const currentGenre = genreList[deckIndex];
  const nextGenre = genreList[deckIndex + 1];
  const deckExhausted = genres.data !== undefined && deckIndex >= genreList.length;

  function commit(direction: Direction) {
    if (!currentGenre) return;
    setExitDirection(direction === "like" ? 1 : -1);
    if (direction === "like") {
      setSelected((prev) => {
        if (prev.size >= MAX_PICKS) return prev; // quietly caps — no error toast for a soft limit
        const next = new Set(prev);
        next.add(currentGenre.id);
        return next;
      });
    }
    setDeckIndex((i) => i + 1);
  }

  function handleDragEnd(_event: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_OFFSET_THRESHOLD || info.velocity.x > SWIPE_VELOCITY_THRESHOLD) {
      commit("like");
    } else if (info.offset.x < -SWIPE_OFFSET_THRESHOLD || info.velocity.x < -SWIPE_VELOCITY_THRESHOLD) {
      commit("skip");
    }
    // Anything short of the threshold isn't handled here at all —
    // `dragConstraints={{ left: 0, right: 0 }}` already springs the
    // card back to center on release for free.
  }

  function restart() {
    setDeckIndex(0);
    setSelected(new Set());
  }

  function finish() {
    setOnboardingGenreIds([...selected]);
    router.push(destination);
  }

  function skip() {
    skipOnboarding();
    router.push(destination);
  }

  const canContinue = selected.size >= MIN_PICKS;

  return (
    <main className="flex min-h-screen flex-col items-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <Logo className="mx-auto mb-8 block text-lg" />

        <h1 className="text-center text-2xl font-bold text-foreground sm:text-3xl">
          What do you want to hear?
        </h1>
        <p className="mt-2 text-center text-sm text-muted">
          {deckExhausted
            ? `You picked ${selected.size} genre${selected.size === 1 ? "" : "s"}.`
            : `Swipe right (or tap ♥) for genres you like — left to skip. Pick at least ${MIN_PICKS}.`}
        </p>

        {genres.isLoading && (
          <div className="mt-8 flex justify-center">
            <Skeleton className="h-80 w-full max-w-xs rounded-3xl sm:h-96" />
          </div>
        )}

        {genres.isError && (
          <p className="mt-6 text-center text-sm text-muted">
            Couldn&apos;t load genres right now — you can always do this later from Home.
          </p>
        )}

        {!genres.isLoading && !genres.isError && !deckExhausted && (
          <>
            <p aria-hidden className="mt-6 text-center text-xs text-muted">
              {deckIndex + 1} / {genreList.length}
            </p>

            <div className="relative mx-auto mt-3 h-80 w-full sm:h-96">
              {/* Next card, peeking out behind the current one — purely
                  decorative depth cue, not interactive. */}
              {nextGenre && (
                <div
                  aria-hidden
                  className="absolute inset-3 scale-[0.94] rounded-3xl opacity-50"
                  style={{ background: coverGradient(nextGenre.id) }}
                />
              )}

              <AnimatePresence custom={exitDirection} mode="popLayout">
                {currentGenre && (
                  <motion.div
                    key={currentGenre.id}
                    custom={exitDirection}
                    variants={cardVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={prefersReducedMotion ? { duration: 0 } : deckSpring}
                    drag={prefersReducedMotion ? false : "x"}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.6}
                    onDragEnd={handleDragEnd}
                    whileDrag={{ scale: 1.03 }}
                    role="group"
                    aria-label={currentGenre.name}
                    className="absolute inset-0 flex cursor-grab items-end justify-center rounded-3xl p-6 shadow-glass active:cursor-grabbing"
                    style={{ background: coverGradient(currentGenre.id) }}
                  >
                    <span className="text-2xl font-bold text-white drop-shadow-sm">
                      {currentGenre.name}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-6 flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={() => commit("skip")}
                aria-label={`Skip ${currentGenre?.name ?? "genre"}`}
                className="flex h-14 w-14 items-center justify-center rounded-full ring-1 ring-border text-muted transition-transform hover:scale-105 hover:text-foreground"
              >
                <X size={22} />
              </button>
              <button
                type="button"
                onClick={() => commit("like")}
                aria-label={`Like ${currentGenre?.name ?? "genre"}`}
                className="bg-codex-gradient flex h-14 w-14 items-center justify-center rounded-full text-white shadow-glow transition-transform hover:scale-105"
              >
                <Heart size={22} fill="white" />
              </button>
            </div>
          </>
        )}

        {deckExhausted && (
          <>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {[...selected].map((id) => {
                const genre = genreList.find((g) => g.id === id);
                if (!genre) return null;
                return (
                  <span
                    key={id}
                    className="relative flex items-center gap-1.5 overflow-hidden rounded-full px-4 py-2 text-sm font-medium text-white"
                    style={{ background: coverGradient(id) }}
                  >
                    <Check size={12} strokeWidth={3} />
                    {genre.name}
                  </span>
                );
              })}
              {selected.size === 0 && (
                <p className="text-sm text-muted">No genres picked yet.</p>
              )}
            </div>
            {selected.size < MIN_PICKS && (
              <p className="mt-3 text-center text-xs text-muted">
                Pick at least {MIN_PICKS} to continue, or restart the deck.
              </p>
            )}
            <div className="mt-4 flex justify-center">
              <button onClick={restart} className="text-sm text-muted underline hover:text-foreground">
                Restart picks
              </button>
            </div>
          </>
        )}

        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            onClick={finish}
            disabled={!canContinue}
            className="bg-codex-gradient w-full max-w-xs rounded-xl py-3 text-center font-medium text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue{selected.size > 0 ? ` (${selected.size})` : ""}
          </button>
          <button onClick={skip} className="text-sm text-muted hover:text-foreground">
            Skip for now
          </button>
        </div>
      </div>
    </main>
  );
}
