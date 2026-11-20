import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { catalog } from "@/lib/catalog";

/**
 * The sitemap is generated per request (the catalog fetches use
 * `cache: "no-store"`), so newly published songs/albums/artists appear without
 * a redeploy. Every catalog call is allowed to fail: during `next build` the
 * API container is not running, and a crawler hitting a booting stack must
 * still receive the static routes instead of a 500.
 */
export const dynamic = "force-dynamic";

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  {
    url: `${SITE_URL}/`,
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    url: `${SITE_URL}/home`,
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: `${SITE_URL}/search`,
    changeFrequency: "weekly",
    priority: 0.6,
  },
  {
    url: `${SITE_URL}/login`,
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    url: `${SITE_URL}/register`,
    changeFrequency: "yearly",
    priority: 0.4,
  },
];

/**
 * Only pages that are useful to a logged-out visitor (and safe to crawl) are
 * listed. Authenticated areas — /library, /admin, /onboarding — are excluded
 * in robots.ts and intentionally absent here.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [songs, albums, artists, genres] = await Promise.all([
    catalog.listAllSongs().catch(() => []),
    catalog.listAllAlbums().catch(() => []),
    catalog.listAllArtists().catch(() => []),
    catalog.listGenres().catch(() => []),
  ]);

  return [
    ...STATIC_ROUTES,
    ...songs.map<MetadataRoute.Sitemap[number]>((song) => ({
      url: `${SITE_URL}/song/${song.slug}`,
      changeFrequency: "monthly",
      priority: 0.7,
    })),
    ...albums.map<MetadataRoute.Sitemap[number]>((album) => ({
      url: `${SITE_URL}/album/${album.slug}`,
      changeFrequency: "monthly",
      priority: 0.6,
    })),
    ...artists.map<MetadataRoute.Sitemap[number]>((artist) => ({
      url: `${SITE_URL}/artist/${artist.slug}`,
      changeFrequency: "monthly",
      priority: 0.6,
    })),
    ...(genres ?? []).map<MetadataRoute.Sitemap[number]>((genre) => ({
      url: `${SITE_URL}/genre/${genre.slug}`,
      changeFrequency: "monthly",
      priority: 0.5,
    })),
  ];
}
