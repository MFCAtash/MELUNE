"use client";

import type { Song } from "@codex-music/types";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useTranslation } from "@/hooks/use-translation";
import { useHomeFeed, useOnboardingSeedSongs } from "@/lib/queries";
import { pickGenreMixes } from "@/lib/home";
import { SongShelf } from "@/components/home/song-shelf";
import { GenreMixesShelf } from "@/components/home/genre-mixes-shelf";
import { MobileHome } from "@/components/home/mobile-home";
import { HeroCoverFan } from "@/components/home/hero-cover-fan";
import { HERO_COVERS, type HeroCover } from "@/lib/hero-covers";
import { TrendingPanel } from "@/components/home/trending-panel";
import { TopArtistsPanel } from "@/components/home/top-artists-panel";
import { PlaylistsPanel } from "@/components/home/playlists-panel";
import { TrackList } from "@/components/player/track-list";
import { PanelHeader } from "@/components/ui/glass-panel";
import { PlayButton } from "@/components/player/play-button";
import { Cover } from "@/components/ui/cover";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorIllustration, EmptyCatalogIllustration } from "@/components/ui/empty-illustrations";
import { ShelfSkeleton, Skeleton } from "@/components/ui/skeleton";

/** The one big moment on Home: a playable mix with stacked artwork. */
function FeaturedMix({
  title,
  description,
  songs,
  covers,
}: {
  title: string;
  description: string;
  songs: Song[];
  /** Curated sleeves for the hero fan (Trending). When omitted the mix
   *  falls back to the first songs' own artwork. */
  covers?: HeroCover[];
}) {
  return (
    <section
      aria-label={title}
      className="relative isolate flex min-h-[15rem] items-center overflow-hidden rounded-3xl p-6 shadow-glow-lg ring-1 ring-white/10 sm:p-8"
      style={{
        // Theme-owned hero: the big card is painted with the active
        // signature theme's brand gradient (classic shells resolve to the
        // original purple→blue). The stacked covers on the right keep the
        // per-title variety that used to come from `coverGradient`.
        background:
          "linear-gradient(135deg, rgb(var(--halo-1)) 0%, rgb(var(--brand-a)) 55%, rgb(var(--brand-b)) 100%)",
      }}
    >
      <div aria-hidden className="absolute inset-0 bg-app-glow opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
      <div className="relative flex w-full items-center justify-between gap-6">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl xl:text-4xl">{title}</h2>
          <p className="mt-2 max-w-sm text-sm text-foreground/85">{description}</p>
          <div className="mt-6">
            <PlayButton tracks={songs} label="Play mix" variant="light" />
          </div>
        </div>
        {covers ? (
          <div className="hidden shrink-0 sm:flex">
            <HeroCoverFan covers={covers} />
          </div>
        ) : (
          <div className="hidden shrink-0 -space-x-8 sm:flex">
            {songs.slice(0, 3).map((song) => (
              <div key={song.id} className="h-28 w-28 overflow-hidden rounded-xl shadow-2xl ring-2 ring-black/30 lg:h-36 lg:w-36">
                <Cover title={song.title} url={song.coverUrl} className="h-full w-full text-4xl" />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Skeleton className="h-60 w-full rounded-3xl" />
        <Skeleton className="h-80 w-full rounded-3xl" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Skeleton className="h-56 w-full rounded-3xl" />
        <Skeleton className="h-56 w-full rounded-3xl" />
      </div>
      <ShelfSkeleton />
    </div>
  );
}

export default function HomePage() {
  const { user, isChecking } = useRequireAuth();
  const feed = useHomeFeed();
  const { t } = useTranslation();
  const data = feed.data;

  const apiMadeForYou = data?.madeForYou ?? [];
  const isNewListener = data ? data.recentlyPlayed.length === 0 && apiMadeForYou.length === 0 : false;
  // History-based "Made for you" wins whenever it exists. Only when the
  // API comes back empty (brand-new account, no plays yet) do we fall
  // back to a mix built from the onboarding genre picks — see
  // lib/onboarding.ts / useOnboardingSeedSongs. Never mixed together, so
  // there's no ambiguity about which one produced a given song.
  const seed = useOnboardingSeedSongs(Boolean(data) && apiMadeForYou.length === 0);
  const usingOnboardingSeed = apiMadeForYou.length === 0 && (seed.data?.length ?? 0) > 0;
  const madeForYou = apiMadeForYou.length > 0 ? apiMadeForYou : (seed.data ?? []);
  // MobileHome reads `madeForYou` straight off the feed object — give it
  // the same fallback-aware value rather than teaching it about the seed too.
  const mobileData = data ? { ...data, madeForYou } : data;
  // "Top artists" is derived from what the feed already returned.
  const artistPool = data ? [...data.trending, ...madeForYou, ...data.recentlyPlayed] : [];
  // Same idea for "Genre mixes" — grouped from each song's existing
  // `genre` field, not a separate API call (see lib/home.ts).
  const genreMixes = pickGenreMixes(artistPool);

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 py-6 lg:gap-8">
      {(isChecking || feed.isLoading) && <HomeSkeleton />}

      {!isChecking && feed.isError && (
        <EmptyState
          illustration={<ErrorIllustration />}
          title="Couldn't load your feed"
          description="Check your connection and try again."
          action={{ label: "Try again", onClick: () => feed.refetch() }}
        />
      )}

      {!isChecking && data && mobileData && (
        <>
          <MobileHome data={mobileData} />

          {/* Desktop / tablet layout (phones use MobileHome above) */}
          <div className="hidden flex-col gap-6 md:flex lg:gap-8">
            {/* Row 1 — hero banner + numbered Trending panel */}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
              {madeForYou.length > 0 ? (
                <FeaturedMix
                  title={t("home.madeForYou")}
                  description={
                    usingOnboardingSeed
                      ? "Based on the genres you picked when you signed up."
                      : `${madeForYou.length} songs from the genres you play most.`
                  }
                  songs={madeForYou}
                />
              ) : (
                data.trending.length > 0 && (
                  <FeaturedMix
                    title="Trending right now"
                    description={
                      isNewListener
                        ? "Play a few songs and we'll build a mix from what you like."
                        : "What everyone's playing this week."
                    }
                    songs={data.trending}
                    covers={HERO_COVERS}
                  />
                )
              )}
              <TrendingPanel songs={data.trending} />
            </div>

            {/* Row 2 — Top artists + the user's playlists */}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <TopArtistsPanel songs={artistPool} variant="spotlight" />
              <PlaylistsPanel />
            </div>

            {/* Row 3 — richer recent-plays list, then the personalised shelf */}
            {data.recentlyPlayed.length > 0 && (
              <section aria-labelledby="home-continue">
                <PanelHeader id="home-continue" title={t("home.continueListening")} />
                <TrackList tracks={data.recentlyPlayed} showArtist variant="rich" />
              </section>
            )}
            <SongShelf title={t("home.madeForYou")} songs={madeForYou} />
            <GenreMixesShelf mixes={genreMixes} />
          </div>

          {data.trending.length === 0 && isNewListener && madeForYou.length === 0 && (
            <EmptyState
              illustration={<EmptyCatalogIllustration />}
              title="The catalog is empty"
              description="Add songs through the API and they'll show up here."
            />
          )}
        </>
      )}
    </main>
  );
}
