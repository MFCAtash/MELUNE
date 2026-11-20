import type { Page, Route } from "@playwright/test";

/**
 * The web app's ApiClient always calls `${NEXT_PUBLIC_API_URL}/api${path}`
 * (see packages/api-client/src/index.ts). CI runs `next build && next
 * start` with no live backend (see docs/database.md /
 * .github/workflows/ci.yml), so every one of these specs runs against
 * this in-memory fake instead of a real NestJS server. Point the app at
 * a dedicated origin via NEXT_PUBLIC_API_URL so we only ever intercept
 * traffic meant for us, never anything else the page might request.
 */
export const API_ORIGIN = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4310";

// ---------------------------------------------------------------- types
// Minimal shapes mirroring @codex-music/types — duplicated (not imported)
// so this file has zero build-time dependency on the workspace package
// graph and can't drift the *shape* of a mock out of sync silently; the
// e2e specs are the check that the real UI still understands them.

export interface MockUser {
  id: string;
  email: string;
  username: string;
  role: "USER" | "ARTIST" | "ADMIN";
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MockArtist {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

export interface MockSong {
  id: string;
  title: string;
  slug: string;
  duration: number;
  audioUrl: string;
  coverUrl: string | null;
  playCount: number;
  artist: MockArtist;
  album: null;
  genre: null;
}

export interface MockPlaylistSummary {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  accentColor: string | null;
  isPublic: boolean;
  owner?: { id: string; username: string };
  createdAt: string;
  updatedAt: string;
}

export interface MockPlaylistEntry {
  id: string;
  position: number;
  addedAt: string;
  song: MockSong;
}

export interface MockPlaylist extends MockPlaylistSummary {
  items: MockPlaylistEntry[];
}

// -------------------------------------------------------------- fixtures

let idSeq = 0;
/** Deterministic-enough ids across a test run without a real UUID lib. */
function nextId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${idSeq}`;
}

export function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  const now = new Date().toISOString();
  return {
    id: nextId("user"),
    email: "listener@example.com",
    username: "listener",
    role: "USER",
    avatarUrl: null,
    bio: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeSong(overrides: Partial<MockSong> = {}): MockSong {
  const id = overrides.id ?? nextId("song");
  return {
    id,
    title: "Midnight Drive",
    slug: "midnight-drive",
    duration: 214,
    audioUrl: "https://example.com/audio/midnight-drive.mp3",
    coverUrl: null,
    playCount: 1280,
    artist: { id: "artist-1", name: "Nova Ray", slug: "nova-ray", imageUrl: null },
    album: null,
    genre: null,
    ...overrides,
  };
}

export function makePlaylistSummary(overrides: Partial<MockPlaylistSummary> = {}): MockPlaylistSummary {
  const id = overrides.id ?? nextId("playlist");
  const now = new Date().toISOString();
  return {
    id,
    title: "My Playlist",
    slug: `my-playlist-${id}`,
    description: null,
    coverUrl: null,
    accentColor: null,
    isPublic: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makePlaylist(overrides: Partial<MockPlaylist> = {}): MockPlaylist {
  return { ...makePlaylistSummary(overrides), items: [], ...overrides };
}

function paginated<T>(items: T[]) {
  return { items, page: 1, limit: Math.max(items.length, 20), total: items.length, totalPages: 1 };
}

// -------------------------------------------------------------- fake API

export interface MockApiState {
  /** Currently "logged in" user — GET /users/me succeeds iff this is set. */
  user: MockUser | null;
  /** Accepted email/password for POST /auth/login. Omit to make every login attempt fail. */
  credentials: { email: string; password: string } | null;
  /** GET /discover/home */
  home: { recentlyPlayed: MockSong[]; trending: MockSong[]; madeForYou: MockSong[] | null };
  /**
   * Every song the test knows about, keyed by id. POST /playlists/:id/songs
   * only receives a bare `songId` on the wire (see ApiClient.addSongToPlaylist),
   * so this is how the fake backend resolves it back to a full `Song` —
   * exactly like a real one would look it up in its own database.
   */
  songs: MockSong[];
  /** GET /playlists/me */
  myPlaylists: MockPlaylistSummary[];
  /** GET /playlists/:idOrSlug, keyed by both id and slug for lookup convenience. */
  playlistDetails: Map<string, MockPlaylist>;
}

export function defaultState(): MockApiState {
  return {
    user: null,
    credentials: null,
    home: { recentlyPlayed: [], trending: [], madeForYou: [] },
    songs: [],
    myPlaylists: [],
    playlistDetails: new Map(),
  };
}

function indexPlaylist(state: MockApiState, playlist: MockPlaylist) {
  state.playlistDetails.set(playlist.id, playlist);
  state.playlistDetails.set(playlist.slug, playlist);
}

async function json(route: Route, status: number, body?: unknown) {
  if (body === undefined) {
    await route.fulfill({ status, contentType: "application/json", body: "" });
    return;
  }
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

/**
 * Installs a single route handler covering every `${API_ORIGIN}/api/**`
 * request the app makes, backed by `state` (mutate it directly, or use
 * the returned handle, to change what the fake API answers mid-test —
 * e.g. after "creating" a playlist, seed its detail so the next
 * navigation's GET finds it).
 */
export async function installApiMocks(page: Page, initial: Partial<MockApiState> = {}) {
  const state: MockApiState = { ...defaultState(), ...initial };
  for (const p of initial.myPlaylists ?? []) {
    if (!state.playlistDetails.has(p.id)) indexPlaylist(state, { ...p, items: [] });
  }

  await page.route(`${API_ORIGIN}/api/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api/, "");
    const method = req.method();

    // ---- auth ----
    if (path === "/auth/login" && method === "POST") {
      const body = req.postDataJSON() as { email: string; password: string };
      if (
        state.credentials &&
        body.email === state.credentials.email &&
        body.password === state.credentials.password &&
        state.user
      ) {
        return json(route, 200, { user: state.user, accessToken: "mock-access-token" });
      }
      return json(route, 401, { statusCode: 401, message: "Invalid email or password" });
    }
    if (path === "/auth/refresh" && method === "POST") {
      // No real refresh cookie exists in these tests — always fail so
      // the client stops retrying instead of looping.
      return json(route, 401, { statusCode: 401, message: "No session" });
    }

    // ---- session ----
    if (path === "/users/me" && method === "GET") {
      if (state.user) return json(route, 200, state.user);
      return json(route, 401, { statusCode: 401, message: "Not authenticated" });
    }

    // ---- home feed ----
    if (path === "/discover/home" && method === "GET") {
      return json(route, 200, state.home);
    }

    // ---- playlists ----
    if (path === "/playlists/me" && method === "GET") {
      return json(route, 200, paginated(state.myPlaylists));
    }
    if (path === "/playlists" && method === "POST") {
      const body = req.postDataJSON() as { title: string; description?: string; isPublic?: boolean };
      const summary = makePlaylistSummary({
        title: body.title,
        description: body.description ?? null,
        isPublic: body.isPublic ?? true,
        owner: state.user ? { id: state.user.id, username: state.user.username } : undefined,
      });
      state.myPlaylists.push(summary);
      indexPlaylist(state, { ...summary, items: [] });
      return json(route, 201, summary);
    }
    const playlistMatch = path.match(/^\/playlists\/([^/]+)$/);
    if (playlistMatch && method === "GET") {
      const playlist = state.playlistDetails.get(decodeURIComponent(playlistMatch[1]));
      if (!playlist) return json(route, 404, { statusCode: 404, message: "Playlist not found" });
      return json(route, 200, playlist);
    }
    const addSongMatch = path.match(/^\/playlists\/([^/]+)\/songs$/);
    if (addSongMatch && method === "POST") {
      const playlist = state.playlistDetails.get(decodeURIComponent(addSongMatch[1]));
      if (!playlist) return json(route, 404, { statusCode: 404, message: "Playlist not found" });
      const { songId } = req.postDataJSON() as { songId: string };
      if (playlist.items.some((i) => i.song.id === songId)) {
        return json(route, 400, { statusCode: 400, message: "That song is already in this playlist." });
      }
      const song = state.songs.find((s) => s.id === songId) ?? makeSong({ id: songId });
      playlist.items.push({
        id: nextId("entry"),
        position: playlist.items.length,
        addedAt: new Date().toISOString(),
        song,
      });
      return json(route, 204);
    }
    const reorderMatch = path.match(/^\/playlists\/([^/]+)\/songs\/reorder$/);
    if (reorderMatch && method === "PATCH") {
      const playlist = state.playlistDetails.get(decodeURIComponent(reorderMatch[1]));
      if (!playlist) return json(route, 404, { statusCode: 404, message: "Playlist not found" });
      const { songIds } = req.postDataJSON() as { songIds: string[] };
      const byId = new Map(playlist.items.map((i) => [i.song.id, i]));
      playlist.items = songIds
        .map((id, i) => {
          const entry = byId.get(id);
          return entry ? { ...entry, position: i } : null;
        })
        .filter((e): e is MockPlaylistEntry => e !== null);
      return json(route, 204);
    }
    const removeSongMatch = path.match(/^\/playlists\/([^/]+)\/songs\/([^/]+)$/);
    if (removeSongMatch && method === "DELETE") {
      const playlist = state.playlistDetails.get(decodeURIComponent(removeSongMatch[1]));
      if (playlist) {
        playlist.items = playlist.items.filter((i) => i.song.id !== removeSongMatch[2]);
      }
      return json(route, 204);
    }

    // ---- anything else the shell/panels touch: answer with a safe,
    // empty default rather than letting the request hang or error, so
    // an unrelated panel never breaks the flow a test is actually
    // exercising. ----
    if (method === "GET") return json(route, 200, paginated([]));
    return json(route, 204);
  });

  return {
    state,
    /** Register a playlist detail directly (bypassing POST /playlists) — handy for seeding a reorder/add-song test. */
    seedPlaylist(playlist: MockPlaylist) {
      indexPlaylist(state, playlist);
      if (!state.myPlaylists.some((p) => p.id === playlist.id)) {
        state.myPlaylists.push(playlist);
      }
    },
  };
}
