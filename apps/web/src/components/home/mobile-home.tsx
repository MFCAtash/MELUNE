"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  Pause,
  Play,
  Search,
  Mic2,
  Disc3,
  ListMusic,
  FolderOpen,
} from "lucide-react";
import type { HomeFeed, Song } from "@codex-music/types";
import { usePlayerStore } from "@/store/player-store";
import { filesToTracks } from "@/lib/local-audio";
import { useUiStore } from "@/store/ui-store";
import { useTranslation } from "@/hooks/use-translation";
import {
  homeSections,
  pickGenreMixes,
  type HomeFilter,
  type HomeSectionId,
} from "@/lib/home";
import type { TranslationKey } from "@/lib/i18n/translate";
import { Cover } from "@/components/ui/cover";
import { HeroCoverFan } from "./hero-cover-fan";
import { HERO_COVERS, type HeroCover } from "@/lib/hero-covers";
import { SongRow } from "./song-row";
import { GenreMixesShelf } from "./genre-mixes-shelf";

const SECTION_TITLE_KEYS = {
  trending: "home.trending",
  forYou: "home.madeForYou",
  recent: "home.continueListening",
} as const satisfies Record<HomeSectionId, TranslationKey>;

const FILTERS: ReadonlyArray<{ id: HomeFilter; labelKey: TranslationKey }> = [
  { id: "all", labelKey: "home.filterAll" },
  { id: "trending", labelKey: "home.filterTrending" },
  { id: "forYou", labelKey: "home.filterForYou" },
  { id: "recent", labelKey: "home.filterRecent" },
];

/** One swipeable card of the "Now trending" carousel. */
function FeaturedCard({
  title,
  songs,
  covers,
}: {
  title: string;
  songs: Song[];
  /** Curated sleeves for the mobile hero strip (Trending only). */
  covers?: HeroCover[];
}) {
  const currentTrackId = usePlayerStore((s) => s.queue[s.currentIndex]?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const { t } = useTranslation();

  const first = songs[0];
  const active = first.id === currentTrackId && isPlaying;
  const onClick = () => (first.id === currentTrackId ? togglePlay() : playQueue(songs, 0));

  return (
    <li
      className="relative w-[85%] shrink-0 snap-start overflow-hidden rounded-3xl p-3 shadow-glow ring-1 ring-white/10"
      style={{
        // Mobile twin of the desktop hero: painted by the active theme.
        background:
          "linear-gradient(135deg, rgb(var(--halo-1)) 0%, rgb(var(--brand-a)) 55%, rgb(var(--brand-b)) 100%)",
      }}
    >
      <div aria-hidden className="absolute inset-0 bg-app-glow opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/25 to-transparent" />
      {covers ? (
        <div className="relative flex flex-col gap-3">
          <HeroCoverFan variant="strip" covers={covers} className="pt-1.5" />
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-foreground">{title}</h3>
            <p className="mt-0.5 line-clamp-2 text-xs text-foreground/85">
              {t("home.songsCount", { count: songs.length })} · {first.artist.name}
            </p>
            <button
              onClick={onClick}
              aria-label={`${active ? t("player.pause") : t("player.play")}: ${title}`}
              className="mt-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-background shadow-lg transition-transform active:scale-95"
            >
              {active ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            </button>
          </div>
        </div>
      ) : (
        <div className="relative flex items-center gap-3">
          <span className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/20">
            <Cover title={first.title} url={first.coverUrl} className="h-full w-full text-4xl" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold text-foreground">{title}</h3>
            <p className="mt-0.5 line-clamp-2 text-xs text-foreground/85">
              {t("home.songsCount", { count: songs.length })} · {first.artist.name}
            </p>
            <button
              onClick={onClick}
              aria-label={`${active ? t("player.pause") : t("player.play")}: ${title}`}
              className="mt-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-background shadow-lg transition-transform active:scale-95"
            >
              {active ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * The Discover menu: the Home search entry, rebuilt from a plain pill
 * into a small brand panel. A shimmering "search everything" trigger
 * opens the ⌘K command palette, and five color-coded category chips
 * deep-link into the Search page with the matching result tab
 * pre-selected (`/search?type=…`) or open the device file picker for
 * full-length local audio. Each chip carries its own palette
 * color (teal/rose/amber/indigo/magenta) so the menu reads as a constellation
 * rather than a form control.
 */
function DiscoverMenu() {
  const openCommandPalette = useUiStore((s) => s.openCommandPalette);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const { t } = useTranslation();
  const localInputRef = useRef<HTMLInputElement>(null);

  /** Import full-length audio files from this device and start playing them. */
  const importLocalFiles = async (fileList: FileList | null) => {
    const files = [...(fileList ?? [])];
    if (localInputRef.current) localInputRef.current.value = "";
    if (files.length === 0) return;
    const tracks = await filesToTracks(files);
    if (tracks.length > 0) playQueue(tracks, 0);
  };

  const categories: {
    href: string;
    labelKey: TranslationKey;
    icon: React.ReactNode;
    /** tailwind classes for the chip's own accent color */
    chip: string;
  }[] = [
    {
      href: "/search?type=songs",
      labelKey: "search.songs",
      icon: <Play size={15} fill="currentColor" />,
      chip: "from-teal-500/80 to-teal-dim/80 shadow-[0_0_18px_-6px_rgba(20,184,166,0.8)]",
    },
    {
      href: "/search?type=artists",
      labelKey: "search.artists",
      icon: <Mic2 size={15} />,
      chip: "from-rose-500/80 to-rose-dim/80 shadow-[0_0_18px_-6px_rgba(244,63,94,0.8)]",
    },
    {
      href: "/search?type=albums",
      labelKey: "search.albums",
      icon: <Disc3 size={15} />,
      chip: "from-amber-500/80 to-amber-dim/80 shadow-[0_0_18px_-6px_rgba(245,158,11,0.8)]",
    },
    {
      href: "/search?type=playlists",
      labelKey: "search.playlists",
      icon: <ListMusic size={15} />,
      chip: "from-indigo-500/80 to-indigo-dim/80 shadow-[0_0_18px_-6px_rgba(99,102,241,0.8)]",
    },
  ];

  return (
    <section
      aria-label={t("home.discover")}
      className="glass-panel relative overflow-hidden !rounded-3xl p-4"
    >
      {/* Slow brand shimmer sweeping the panel — the "menu is alive"
          affordance. Purely decorative, disabled for reduced motion. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent motion-safe:animate-[discoverShimmer_5s_ease-in-out_infinite]"
      />

      <button
        onClick={openCommandPalette}
        aria-label={t("search.openHint")}
        className="group relative flex h-12 w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-start text-sm text-muted transition-colors hover:border-primary/60 hover:text-foreground focus-visible:border-primary focus-visible:outline-none"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-codex-gradient text-white shadow-glow-sm">
          <Search size={16} aria-hidden />
        </span>
        <span className="flex-1 truncate">{t("search.placeholder")}</span>
        <kbd
          aria-hidden
          className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-muted"
        >
          ⌘K
        </kbd>
      </button>

      <div className="relative mt-3 grid grid-cols-5 gap-2">
        {categories.map(({ href, labelKey, icon, chip }) => (
          <Link
            key={href}
            href={href}
            className={`card-lift flex flex-col items-center gap-1.5 rounded-2xl bg-gradient-to-br p-2.5 text-white ring-1 ring-white/15 ${chip}`}
          >
            {icon}
            <span className="w-full truncate text-center text-[11px] font-medium">
              {t(labelKey)}
            </span>
          </Link>
        ))}

        {/* Local files: play full-length songs straight from this device */}
        <input
          ref={localInputRef}
          type="file"
          accept="audio/*,.m4a,.mp3,.wav,.flac,.ogg,.oga,.aac,.opus,.wma,.aif,.aiff,.alac"
          multiple
          hidden
          onChange={(e) => void importLocalFiles(e.target.files)}
        />
        <button
          onClick={() => localInputRef.current?.click()}
          title={t("local.hint")}
          className="card-lift flex flex-col items-center gap-1.5 rounded-2xl bg-gradient-to-br p-2.5 text-white ring-1 ring-white/15 from-magenta-500/80 to-magenta-dim/80 shadow-[0_0_18px_-6px_rgba(217,70,239,0.8)]"
        >
          <FolderOpen size={15} />
          <span className="w-full truncate text-center text-[11px] font-medium">
            {t("local.files")}
          </span>
        </button>
      </div>
    </section>
  );
}

/**
 * The phone Home (below `md`): the Discover menu, filter chips, a
 * swipeable "Now trending" carousel and compact song rows. Desktop uses the
 * panel layout in the Home page instead.
 */
export function MobileHome({ data }: { data: HomeFeed }) {
  const [filter, setFilter] = useState<HomeFilter>("all");
  const { t } = useTranslation();

  const carousel = homeSections(data, "all");
  const sections = homeSections(data, filter);
  // Same derivation as the desktop layout (lib/home.ts) — grouped from
  // songs this feed already returned, not a separate fetch.
  const genreMixes = pickGenreMixes([...data.trending, ...(data.madeForYou ?? []), ...data.recentlyPlayed]);

  return (
    <div className="flex flex-col gap-5 md:hidden">
      <DiscoverMenu />

      <div
        role="group"
        aria-label={t("home.filtersLabel")}
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4"
      >
        {FILTERS.map(({ id, labelKey }) => {
          const selected = filter === id;
          return (
            <button
              key={id}
              onClick={() => setFilter(id)}
              aria-pressed={selected}
              className={`shrink-0 rounded-xl border px-4 py-2 text-sm transition-colors ${
                selected
                  ? "border-primary bg-primary/25 text-white"
                  : "border-white/10 bg-white/[0.04] text-muted hover:text-foreground"
              }`}
            >
              {t(labelKey)}
            </button>
          );
        })}
      </div>

      {carousel.length > 0 && (
        <section aria-labelledby="m-home-now-trending">
          <h2 id="m-home-now-trending" className="text-gradient mb-3 text-lg font-semibold">
            {t("home.nowTrending")}
          </h2>
          <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
            {carousel.map((section) => (
              <FeaturedCard
                key={section.id}
                title={t(SECTION_TITLE_KEYS[section.id])}
                songs={section.queue}
                covers={section.id === "trending" ? HERO_COVERS : undefined}
              />
            ))}
          </ul>
        </section>
      )}

      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`m-home-${section.id}`}>
          <h2 id={`m-home-${section.id}`} className="text-gradient mb-3 text-lg font-semibold">
            {t(SECTION_TITLE_KEYS[section.id])}
          </h2>
          <ul className="flex flex-col gap-2">
            {section.songs.map((song) => (
              <SongRow key={song.id} song={song} queue={section.queue} />
            ))}
          </ul>
        </section>
      ))}

      <GenreMixesShelf mixes={genreMixes} />
    </div>
  );
}
