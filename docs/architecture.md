# Architecture — through Phase 5

## Overview

Codex Music is a monorepo containing independently deployable apps and
services that share typed contracts through internal packages.

```
codex-music/
├── apps/
│   ├── web/        Next.js 14 (App Router) — customer-facing web app          [Implemented]
│   ├── api/         NestJS — REST API, auth, business logic                  [Implemented]
│   └── mobile/      React Native + Expo                                       [Initial skeleton, Phase 10 — see apps/mobile/README.md]
├── services/
│   └── ai/          FastAPI, proxying to the API's recommender for now       [Initial skeleton, Phase 8/9 — see services/ai/README.md]
├── packages/
│   ├── types/       Shared TypeScript types (User, HealthStatus, ...)
│   ├── config/       Shared ESLint/TS config
│   ├── api-client/   Typed fetch client — auth (Phase 2) + library/discover (Phase 5)
│   ├── ui/           Reserved — shared UI primitives (Phase 6+)
│   └── utils/        Reserved — shared utilities
├── infra/
│   ├── docker/       Dockerfiles per app
│   ├── nginx/        Reserved — reverse proxy config (Phase 12)
│   └── database/     Reserved — seed/backup scripts
└── docs/
```

## Phase 1 scope

- Monorepo wired with npm workspaces.
- Docker Compose for local Postgres + Redis + API + Web.
- Prisma configured against PostgreSQL, `User` model scaffolded
  (full schema — Artist, Album, Song, Playlist, etc. — lands in Phase 3
  and Phase 5, per the roadmap, so each migration maps to a real feature
  instead of a guessed one).
- NestJS base app: global validation, Helmet, CORS, rate limiting
  (`@nestjs/throttler`), global `/api` prefix.
- `GET /api/health` — Terminus-based health check that verifies the
  Postgres connection through Prisma.
- Next.js base app: App Router, Tailwind with the Codex Music dark/purple
  design tokens, a placeholder bootstrap page.
- Shared `@codex-music/types` package consumed by the web app (and later
  the API and mobile app).
- Jest unit + e2e test scaffolding for the API, including a passing
  `/api/health` e2e test.

## What is intentionally not built yet

Per the phased plan, catalog entities, auth flows, the player, search,
analytics, the AI service, the mobile app, and the admin dashboard were
**not** part of Phase 1. Building them then would have meant guessing at
contracts before the phases that define them (Phase 2 Auth, Phase 3
Catalog, etc.). Phase 1 only had to prove the foundation boots cleanly.

Catalog, auth, player, search, analytics (admin analytics done; the
user-facing "rewind" piece partial/not started), and the admin dashboard
have since landed in later phases (see the roadmap in the root
[README.md](../README.md)). Two pieces are still genuinely incomplete —
this section says exactly how incomplete, so the table above isn't taken
as a claim that they're built:

- **`apps/mobile`** is an initial skeleton (Expo + React Native): a login
  screen and a screen that plays one sample song via `expo-av`, both
  calling the real `@codex-music/api-client`/`@codex-music/types`
  packages against the real API. The access token now persists across
  restarts via `expo-secure-store` (re-validated with `GET /users/me`
  on launch), but there is still no refresh token, so a session only
  survives until the short-lived access token itself expires. No
  navigation library, no design system (NativeWind is not wired in), no
  other screens, not built or tested on a device, not in CI. See
  [apps/mobile/README.md](../apps/mobile/README.md).
- **`services/ai`** is an initial skeleton (FastAPI): `GET /health` and
  `GET /recommend` exist, but `/recommend` is a thin proxy to the
  existing NestJS `RecommendationsService` (`GET /api/recommendations/for-you`)
  — there is no model, no training pipeline, and none of
  pandas/scikit-learn/PyTorch are used yet. It exists to reserve the
  service's future public contract, not to do collaborative filtering.
  It's now wired into `docker-compose.yml` and starts with the rest of
  the stack, but nothing else in the stack calls it. See
  [services/ai/README.md](../services/ai/README.md).

## Request flow (current)

```
Browser
  → GET /  (Next.js bootstrap page)

Client / curl
  → GET /api/health
      → NestJS HealthController
          → Terminus HealthCheckService
              → PrismaService.$queryRaw("SELECT 1")
                  → PostgreSQL
```

## Environment

All services read configuration from `.env` (see `.env.example`).
`ConfigModule` is registered as global in the API so any future module
can inject `ConfigService` without re-importing it.

## Music player (Phase 4)

Global playback state lives in a Zustand store
(`apps/web/src/store/player-store.ts`) that is pure state + actions —
it never touches the DOM. A single `<PlayerEngine>` component, mounted
once in the root layout, owns the actual `<audio>` element and syncs
it to the store (play/pause, volume, track changes, explicit seeks via
a `seekVersion` counter to avoid feedback loops with `timeupdate`).

Because both `PlayerEngine` and `PersistentPlayer` live in
`app/layout.tsx`, they persist across client-side navigation — playback
never stops when the user browses to another page.

```
User clicks a track row (TrackList / PlayButton)
  → playerStore.playQueue(tracks, index)
      → store state changes (queue, currentIndex, isPlaying)
          → PlayerEngine's effects react → <audio> src/play/pause
          → PersistentPlayer / FullScreenPlayer re-render from the store
```

Like and add-to-playlist are wired to the real Library endpoints
(Phase 5) — see "Library, Discover & Home" below. Nothing here is
disabled or stubbed anymore.

## Merged UI/UX layer (Phase 4 enrichment)

A separate exploratory build of this project (a "Frontend Design first"
variant, all Mock data, no backend) produced several strong visual/UX
ideas. Rather than keep two divergent codebases, the real ones were
ported into this app — on top of real catalog data, not mock data:

**Ported (real, functional, works with actual song data):**
- `hooks/use-ambient-color.ts` — real Canvas-based dominant-color
  extraction from `coverUrl` when present; falls back to a
  deterministic per-song hue (hashed from title+artist) when there's
  no artwork yet, so every track still gets a distinct ambient glow
  instead of one flat color for all of them.
- `components/player/vinyl-cover.tsx` — spins while playing, respects
  `prefers-reduced-motion` (see `globals.css`), shows real cover art
  when available.
- `components/player/audio-visualizer.tsx` — lightweight CSS-only bars
  tied to `isPlaying` (no Web Audio analyser — same tradeoff the
  original made, for performance and simplicity).
- `components/player/share-card-button.tsx` — generates a real,
  downloadable PNG (Canvas `toBlob`) with the track title/artist. Does
  **not** embed remote cover art in the canvas — cross-origin images
  without CORS headers taint the canvas and break export, and this
  project doesn't control the storage host's CORS policy yet — so the
  card uses the brand gradient instead. Revisit once Phase 12 (or
  storage setup) can guarantee CORS-safe asset URLs.

**Deliberately NOT ported:** Friend Activity, Listening Party, and
Rewind/Wrapped widgets. The original built these against fabricated
mock names and fake "currently listening" data. This project has no
Follow relationships yet — Phase 5 shipped Likes/Playlists/Library/
History, but Follow was left out on purpose (nothing yet queries it;
see `schema.prisma`) — so building that UI now would be exactly the
kind of decorative, fake-data scaffolding this project's own rules
(see the original prompt, section 32/"Development Rules") rule out.
`lib/contracts/realtime.ts` captures the intended shape so a real
widget can be built the moment a future phase ships Follow data — but
not before.

**Also ported, adapted to this project's real data model:**
- `lib/contracts/lyrics.ts` — the same "interface first" pattern the
  original used for realtime, applied to lyrics: `FullScreenPlayer`'s
  Lyrics tab renders against this interface with
  `mockLyricsProvider` (clearly labeled as placeholder text) as the
  only implementation. Swapping in real synced lyrics later — once
  there's a `lyrics` field/table and an ingestion path — means
  implementing `LyricsProvider` and nothing else changes.

## Library, Discover & Home (Phase 5)

Five new Prisma models — `Like`, `Playlist`, `PlaylistSong`,
`LibraryItem`, `ListeningHistory` — back four NestJS modules under
`apps/api/src/library/` (`likes/`, `playlists/`, `saved-items/`,
`history/`) plus `apps/api/src/discover/` for the aggregated Home feed.
See `docs/api.md` for the full endpoint list.

Two design choices worth calling out:

- **`madeForYou` is `null`, not an empty array or a fallback list**,
  when the caller has no listening history yet. `DiscoverService`
  computes it from the caller's top-3 genres by play count in
  `ListeningHistory` — with no history, there's no genre signal, and
  returning unrelated songs labeled "made for you" would be exactly
  the fake-personalization pattern this project avoids. The web app
  renders a "play a few songs" prompt instead in that case.
- **History is append-only.** `ListeningHistory` rows are never
  updated or deleted — `HistoryService.recordPlay` only inserts, in
  the same transaction as the `Song.playCount` increment, so Trending
  (sorted by `playCount`) and Recently Played (read from history rows)
  can't drift apart. This also means the table is already
  Rewind/Wrapped-ready for Phase 7 without a schema change.

The web app calls all of this through `@codex-music/api-client`'s
`ApiClient` (the same authenticated client Phase 2 built for auth —
despite the stale "Reserved for Phase 6" note that used to be in this
file; it's been the real fetch client since Phase 2 and now carries
the Phase 5 methods too).
`apps/web/src/app/home/page.tsx` is no longer the Phase 1 placeholder
page — it calls `GET /api/discover/home` and renders `recentlyPlayed`
/ `madeForYou` / `trending` as real shelves.
`LikeButton` and `AddToPlaylistButton`
(`apps/web/src/components/library/`) replace the two `disabled`
buttons the Phase 4 player shipped with.

**Known gap (narrowed in Phase 5.1):** `Song` responses from the catalog
endpoints still don't carry a per-viewer `isLiked` flag. `LikeButton`
now reads its initial state from a cached list of the user's 100 most
recent likes (`useLikedIds`), so recent likes render filled; an older
like beyond that window would still mount unfilled. The complete fix is
an auth-aware query in `SongsService` (join against `Like` for the
current user) and remains deferred.

## Phase 5.1 — front-end structure

- **Route groups.** `app/(app)/` holds every in-app page (home, library,
  playlist, album, artist, song, genre) and wraps them in `AppShell`
  (sidebar, top bar, mobile bottom nav). `/`, `/login`, `/register` and
  the password pages stay outside it. URLs are unchanged.
- **Session bootstrap.** `Providers` mounts React Query and runs a single
  session check on load (`/users/me`, which silently refreshes via the
  httpOnly cookie). `auth-store.ready` flips when it finishes, so guards
  and the landing redirect never mistake "checking" for "logged out".
  `useRequireAuth` redirects guests to `/login?next=…`; `safeRedirect`
  only honours same-site paths.
- **Landing.** Server-rendered for crawlers; `LandingGate` (client) covers
  it with a splash while checking and redirects logged-in users to `/home`.
- **Data layer.** Client fetching goes through `lib/queries.ts`
  (key factory + hooks). Mutations are optimistic where the result is
  visible instantly (likes, save, remove/reorder in a playlist) with
  rollback on error. Catalog pages (album/artist/song/genre) stay
  Server Components and don't use React Query.
- **Skeletons.** `components/ui/skeleton.tsx` provides shelf, card-grid
  and track-row placeholders that match the real layouts.
- **Artwork fallback.** `Cover` uses the real image when present, else a
  stable on-brand gradient hashed from the title — tiles no longer all
  look identical while uploads don't exist.
- **Player + nav.** `PersistentPlayer` lifts itself above the phone
  bottom nav on shell routes (`isShellRoute`).

**Still not built:** Search (nav item and top-bar field are visibly
disabled, not dead links), playlist drag-and-drop (up/down buttons
instead), profile pages, onboarding, offline/PWA, Media Session and
keyboard shortcuts, i18n/RTL.

**Still not built (unchanged from the roadmap, not a Phase 5 gap):**
Follow/social graph, crossfade/gapless playback, offline downloads,
mood tagging, voice search, signed playback URLs, real file
upload/storage. These remain Phase 6+ items — see
`docs/development.md`.

## Async Processing — Audio Transcode Queue (HLS / Adaptive Bitrate)

Songs stream two ways, chosen automatically by `PlayerEngine`
(`apps/web/src/components/player/player-engine.tsx`) with no user-facing
setting:

- **Direct file** (`Song.audioUrl`) — the original file the artist
  uploaded, played straight from the `<audio>` element. This is the
  only path that existed before this feature and it never goes away:
  every song is always playable this way, regardless of anything below.
- **HLS / adaptive bitrate** (`Song.hlsPlaylistUrl`) — a `.m3u8` master
  playlist over three constant-bitrate AAC renditions (128k/192k/320k),
  generated asynchronously after upload. `hls.js` plays it in most
  browsers; Safari/iOS use their native HLS support instead. `null`
  until the async job below finishes — or forever, if it never runs or
  fails — in which case playback is indistinguishable from a song that
  never had this field at all.

**Why async, and why a separate worker/container:** presigned uploads
(`StorageService.createUploadUrl`, `apps/api/src/storage/`) go straight
from the browser to the bucket — the API never sees the bytes and there's
no upload-completion webhook in this stack. So "after upload" is
implemented as "once a `Song` row is created/updated with that
`audioUrl`" (`SongsService.createRecord` / `SongsService.update`), the
earliest point the API can reliably tie an uploaded object to a song.
That handler calls `StorageService.transcodeAudio(songId, sourceKey)`,
which enqueues one BullMQ job (`audio-transcode` queue, jobId
`transcode:<songId>` so a re-upload replaces rather than duplicates
pending work) on the same Redis instance `CacheService` already uses —
with its own dedicated connection, since BullMQ requires
`maxRetriesPerRequest: null` where `CacheService`'s client is tuned to
fail fast on a cache miss instead.

The job itself is never processed inline in the API process. A
standalone script, `apps/api/src/queue/workers/audio-transcode.worker.ts`
— not a Nest application, to avoid dragging in the whole module graph for
what is really just "pop a job, run ffmpeg, upload files, update one
row" — downloads the original audio, runs one `ffmpeg` invocation
producing the three renditions plus a master playlist
(`-var_stream_map`, the standard pattern for audio-only adaptive
bitrate), uploads the resulting directory back into the same bucket
under `hls/<songId>/`, and writes the resulting master-playlist URL to
`Song.hlsPlaylistUrl`. `ffmpeg` only exists in this worker's own image
(`infra/docker/worker.Dockerfile`) — neither the `api` nor `web`
container needs it.

**Failure is by design a no-op, never a blocker:** every step above —
queuing the job, the transcode itself, the upload, the DB write — is
wrapped so a failure just leaves `hlsPlaylistUrl` unset and logs a
warning. `docker-compose.yml`'s `transcode-worker` service can be
stopped entirely (or crash-loop, or never have been started) and every
song still plays; jobs simply queue up in Redis until it's back. This
mirrors the same fail-open philosophy `CacheService` already uses for
Redis being down.

**Known gaps:** no re-transcode/backfill job for songs uploaded before
this feature shipped (they simply have `hlsPlaylistUrl: null` forever,
same as a failed job); no job-progress UI for artists; segment/playlist
objects for a deleted song's HLS output aren't cleaned up (only the
original `audioUrl` object is, via `cleanupReplacedFile`) — same
"orphaned bucket object" tradeoff soft-deletes already accept elsewhere
in this codebase.

