/**
 * Single source of truth for the public site identity.
 *
 * NEXT_PUBLIC_SITE_URL is baked in at build time (see
 * infra/docker/web.Dockerfile) so metadata, the sitemap, robots.txt and the
 * OpenGraph image all agree on one absolute origin. The localhost fallback
 * keeps `next dev` and `next build` working without any env file.
 */
const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const SITE_URL = rawSiteUrl.replace(/\/+$/, "");

export const SITE_NAME = "MELUNE";

export const SITE_TITLE = "MELUNE — Your Music. Smarter.";

export const SITE_DESCRIPTION =
  "MELUNE is a Persian-first music streaming and discovery ecosystem: 21 themes, a five-cover Cover Flow hero, playlists, offline listening and recommendations built from what you actually play.";

export const SITE_KEYWORDS = [
  "MELUNE",
  "music streaming",
  "music discovery",
  "Persian music",
  "پخش موسیقی",
  "موسیقی فارسی",
  "playlists",
  "web player",
];

export const SITE_LOCALES = ["en", "fa"] as const;
