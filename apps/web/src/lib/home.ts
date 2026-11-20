import type { ArtistSummary, Genre, HomeFeed, Song } from "@codex-music/types";

export interface TopArtist {
  artist: ArtistSummary;
  /** Total plays across the songs we were given for this artist. */
  plays: number;
}

/**
 * Derives a "Top artists" list from songs the Home feed already returns —
 * no extra API call. Songs that appear in several shelves are counted
 * once; artists are ranked by total plays (ties keep first-seen order).
 */
export function pickTopArtists(songs: Song[], limit = 4): TopArtist[] {
  const seenSongs = new Set<string>();
  const byArtist = new Map<string, TopArtist>();

  for (const song of songs) {
    if (seenSongs.has(song.id)) continue;
    seenSongs.add(song.id);
    const entry = byArtist.get(song.artist.id);
    if (entry) entry.plays += song.playCount;
    else byArtist.set(song.artist.id, { artist: song.artist, plays: song.playCount });
  }

  return [...byArtist.values()].sort((a, b) => b.plays - a.plays).slice(0, limit);
}

export interface GenreMix {
  genre: Genre;
  /** Real songs already tagged with this genre by the feeds passed in —
   *  also used as the play queue, so "Play" queues exactly what's shown. */
  songs: Song[];
}

const GENRE_MIX_MIN_SONGS = 3;

/**
 * Groups songs the Home feed already returned by their existing `genre`
 * field — no extra API call, no invented song↔genre relationships, same
 * "derive from what we were already given" approach as `pickTopArtists`
 * above. A genre with fewer than `minSongs` distinct songs is dropped: a
 * two-song "mix" doesn't read as a real mix, and there's no larger genre
 * catalog available here to pad it with (the API's `HomeFeed` has no
 * separate genre-grouped endpoint — see CHANGES-phase10_3-home-redesign.md).
 */
export function pickGenreMixes(songs: Song[], limit = 6, minSongs = GENRE_MIX_MIN_SONGS): GenreMix[] {
  const seenSongs = new Set<string>();
  const byGenre = new Map<string, GenreMix>();

  for (const song of songs) {
    if (!song.genre || seenSongs.has(song.id)) continue;
    seenSongs.add(song.id);
    const entry = byGenre.get(song.genre.id);
    if (entry) entry.songs.push(song);
    else byGenre.set(song.genre.id, { genre: song.genre, songs: [song] });
  }

  return [...byGenre.values()]
    .filter((mix) => mix.songs.length >= minSongs)
    .sort((a, b) => b.songs.length - a.songs.length)
    .slice(0, limit);
}

// ------------------------------------------------------------------
// Mobile Home: filter chips + sections
// ------------------------------------------------------------------

export type HomeFilter = "all" | "trending" | "forYou" | "recent";
export type HomeSectionId = Exclude<HomeFilter, "all">;

export interface HomeSection {
  id: HomeSectionId;
  /** Rows to show. */
  songs: Song[];
  /** The whole list, used as the play queue when a row is tapped. */
  queue: Song[];
}

const PREVIEW_ROWS = 4;
const FILTERED_ROWS = 12;

/**
 * Splits the Home feed into sections for the mobile layout. `all` shows a
 * short preview of every non-empty section; a specific filter shows just
 * that section, longer. Empty sections are always dropped.
 */
export function homeSections(feed: HomeFeed, filter: HomeFilter): HomeSection[] {
  const all: Array<Pick<HomeSection, "id" | "queue">> = [
    { id: "trending", queue: feed.trending },
    { id: "forYou", queue: feed.madeForYou ?? [] },
    { id: "recent", queue: feed.recentlyPlayed },
  ];
  const limit = filter === "all" ? PREVIEW_ROWS : FILTERED_ROWS;
  return all
    .filter((s) => s.queue.length > 0 && (filter === "all" || s.id === filter))
    .map((s) => ({ ...s, songs: s.queue.slice(0, limit) }));
}

export type GreetingPeriod = "night" | "morning" | "afternoon" | "evening";

export function greetingPeriod(hour: number): GreetingPeriod {
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
