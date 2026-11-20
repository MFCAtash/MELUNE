import type { Album, Artist, Genre, Paginated, Song } from "@melune/types";

/**
 * Server-side catalog fetches (React Server Components).
 *
 * These run inside the web container, not in the browser, so a relative
 * `/api` URL is not enough — Node needs an absolute URL. In production the
 * compose stack sets API_INTERNAL_URL to the internal service name
 * (`http://api:4000`); locally it falls back to localhost.
 */
const API_URL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? "http://api:4000" : "http://localhost:4000");

async function getJson<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}/api${path}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Request to ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Walks every page of a paginated public list endpoint. The catalog is small
 * (hundreds of rows), so the cap is a safety net against a malformed
 * `totalPages`, not a real limit.
 */
async function getAllPages<T>(path: string, maxPages = 25): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    // The API caps `limit` at 100 (PaginationQueryDto).
    const res = await getJson<Paginated<T>>(`${path}?page=${page}&limit=100`);
    if (!res || res.items.length === 0) break;
    items.push(...res.items);
    if (page >= res.totalPages) break;
  }
  return items;
}

export const catalog = {
  getSong: (idOrSlug: string) => getJson<Song>(`/songs/${idOrSlug}`),
  getAlbum: (idOrSlug: string) => getJson<Album>(`/albums/${idOrSlug}`),
  getArtist: (idOrSlug: string) => getJson<Artist>(`/artists/${idOrSlug}`),
  getGenre: (idOrSlug: string) => getJson<Genre>(`/genres/${idOrSlug}`),
  // GET /genres is @Public() on the API and unpaginated (genres are a
  // small, fixed-ish list) — used by the onboarding genre picker.
  listGenres: () => getJson<Genre[]>(`/genres`),
  listSongsByGenre: (genreId: string) =>
    getJson<Paginated<Song>>(`/songs?genreId=${genreId}&limit=50`),
  // Used by sitemap.ts to list every public detail page. Same endpoints the
  // browse pages use, so no new API surface is required.
  listAllSongs: () => getAllPages<Song>(`/songs`),
  listAllAlbums: () => getAllPages<Album>(`/albums`),
  listAllArtists: () => getAllPages<Artist>(`/artists`),
};
