import { describe, it, expect } from "vitest";
import type { Song } from "@melune/types";
import type { HomeFeed } from "@melune/types";
import { greetingPeriod, homeSections, pickGenreMixes, pickTopArtists } from "../home";
import { seekBy } from "../player-utils";
import { formatCount } from "../format";

function song(
  id: string,
  artistId: string,
  playCount: number,
  genre: Song["genre"] = null,
): Song {
  return {
    id,
    title: id,
    slug: id,
    duration: 180,
    audioUrl: "",
    coverUrl: null,
    playCount,
    artist: { id: artistId, name: artistId, slug: artistId, imageUrl: null },
    album: null,
    genre,
  };
}

describe("pickTopArtists", () => {
  it("ranks artists by total plays and counts repeated songs once", () => {
    const songs = [song("a1", "A", 10), song("b1", "B", 50), song("a2", "A", 60), song("a1", "A", 10)];
    const result = pickTopArtists(songs, 4);
    expect(result.map((r) => r.artist.id)).toEqual(["A", "B"]);
    expect(result[0].plays).toBe(70);
  });

  it("respects the limit", () => {
    const songs = [song("a", "A", 3), song("b", "B", 2), song("c", "C", 1)];
    expect(pickTopArtists(songs, 2)).toHaveLength(2);
  });
});

describe("pickGenreMixes", () => {
  const rock = { id: "g-rock", name: "Rock", slug: "rock" };
  const jazz = { id: "g-jazz", name: "Jazz", slug: "jazz" };

  it("groups songs by genre and drops genres below the minimum", () => {
    const songs = [
      song("r1", "A", 1, rock),
      song("r2", "A", 1, rock),
      song("r3", "A", 1, rock),
      song("j1", "B", 1, jazz), // only one jazz song — dropped by default minSongs
    ];
    const mixes = pickGenreMixes(songs);
    expect(mixes.map((m) => m.genre.id)).toEqual(["g-rock"]);
    expect(mixes[0].songs).toHaveLength(3);
  });

  it("ignores songs with no genre and counts a repeated song once", () => {
    const songs = [
      song("r1", "A", 1, rock),
      song("r2", "A", 1, rock),
      song("r1", "A", 1, rock), // duplicate id, e.g. also appears in recentlyPlayed
      song("u1", "A", 1, null),
    ];
    const mixes = pickGenreMixes(songs, 6, 2);
    expect(mixes).toHaveLength(1);
    expect(mixes[0].songs).toHaveLength(2);
  });

  it("sorts by mix size and respects the limit", () => {
    const many = (prefix: string, genre: Song["genre"], n: number) =>
      Array.from({ length: n }, (_, i) => song(`${prefix}${i}`, prefix, i, genre));
    const songs = [...many("r", rock, 3), ...many("j", jazz, 5)];
    const mixes = pickGenreMixes(songs, 1, 2);
    expect(mixes).toHaveLength(1);
    expect(mixes[0].genre.id).toBe("g-jazz");
  });
});

describe("formatCount", () => {
  it("compacts large numbers", () => {
    expect(formatCount(950)).toBe("950");
    expect(formatCount(12_400)).toBe("12.4K");
    expect(formatCount(3_200_000)).toBe("3.2M");
  });
});

describe("homeSections", () => {
  const many = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => song(`${prefix}${i}`, prefix, i));
  const feed: HomeFeed = { trending: many("t", 10), madeForYou: null, recentlyPlayed: many("r", 2) };

  it("previews every non-empty section for `all` and drops empty ones", () => {
    const sections = homeSections(feed, "all");
    expect(sections.map((s) => s.id)).toEqual(["trending", "recent"]);
    expect(sections[0].songs).toHaveLength(4);
    expect(sections[0].queue).toHaveLength(10);
  });

  it("shows a single, longer section for a specific filter", () => {
    const sections = homeSections(feed, "trending");
    expect(sections).toHaveLength(1);
    expect(sections[0].songs).toHaveLength(10);
  });

  it("returns nothing for a filter whose section is empty", () => {
    expect(homeSections(feed, "forYou")).toEqual([]);
  });
});

describe("greetingPeriod", () => {
  it("maps hours to periods", () => {
    expect(greetingPeriod(2)).toBe("night");
    expect(greetingPeriod(9)).toBe("morning");
    expect(greetingPeriod(14)).toBe("afternoon");
    expect(greetingPeriod(21)).toBe("evening");
  });
});

describe("seekBy", () => {
  it("clamps to the track bounds", () => {
    expect(seekBy(5, -10, 200)).toBe(0);
    expect(seekBy(195, 10, 200)).toBe(200);
    expect(seekBy(50, 10, 200)).toBe(60);
  });

  it("only clamps at zero while the duration is unknown", () => {
    expect(seekBy(3, -10, 0)).toBe(0);
    expect(seekBy(3, 10, 0)).toBe(13);
  });
});
