# Development Guide — through Phase 6

## Prerequisites

- Node.js ≥ 20
- Docker + Docker Compose

## First-time setup

```bash
cp .env.example .env
npm install
```

## Running with Docker (recommended)

```bash
npm run docker:up
```

This starts Postgres, Redis, the API (`:4000`), and the web app (`:3000`).

## Running natively

```bash
# Terminal 1 — infra only
docker compose up postgres redis

# Terminal 2 — API
npm run prisma:generate
npm run prisma:migrate
npm run dev:api

# Terminal 3 — Web
npm run dev:web
```

## Verifying Phase 1

```bash
curl http://localhost:4000/api/health
# -> {"status":"ok","info":{"database":{"status":"up"}}, ...}
```

Open http://localhost:3000 — you should see the MELUNE bootstrap
page with the gradient wordmark.

## Verifying Phase 2

```bash
# Run the first migration (User + auth tables)
npm run prisma:migrate --workspace=apps/api -- --name add_auth

# Register
curl -i -c cookies.txt -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@melune.music","username":"demo","password":"supersecret"}'

# Get current user with the returned accessToken
curl http://localhost:4000/api/users/me \
  -H "Authorization: Bearer <accessToken from above>"

# Refresh using the cookie jar
curl -i -b cookies.txt -c cookies.txt -X POST http://localhost:4000/api/auth/refresh
```

Or in the browser: visit http://localhost:3000/register, create an
account, and you should land on `/home` showing your username.

## Verifying Phase 3

```bash
# Run the catalog migration
npm run prisma:migrate --workspace=apps/api -- --name add_catalog

# Make yourself an artist (via Prisma Studio or psql), or register a
# new account and set its role to ARTIST, then:

# Create an artist profile
curl -X POST http://localhost:4000/api/artists \
  -H "Authorization: Bearer <artistAccessToken>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo Artist"}'

# Create an album, then a song under it
curl -X POST http://localhost:4000/api/albums \
  -H "Authorization: Bearer <artistAccessToken>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Demo Album"}'

curl -X POST http://localhost:4000/api/songs \
  -H "Authorization: Bearer <artistAccessToken>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Demo Song","albumId":"<albumId>","duration":180,"audioUrl":"https://example.com/demo.mp3"}'
```

Then visit http://localhost:3000/artist/demo-artist,
http://localhost:3000/album/demo-album, and
http://localhost:3000/song/demo-song in the browser.

## Verifying Phase 4

No backend changes — the player is entirely client-side, built on top
of Phase 3's catalog data.

```bash
npm install
npm run test --workspace=apps/web
```

In the browser: open any album or artist page and click a track row
(or the Play button). You should see a persistent bar appear at the
bottom of the screen that keeps playing as you navigate to other
pages. Try shuffle, repeat, seeking, volume, and — on a narrow
viewport — tap the mini-player to open the full-screen view with the
Lyrics placeholder tab.

## Verifying the merged UI/UX layer

```bash
npm run test --workspace=apps/web
```

In the browser, open the full-screen player (tap the mini-player, or
shrink the window below `sm`):
- The cover should **spin** while playing and pause when paused.
- The background behind it should have a soft colored glow — a
  different, stable hue per song (no cover art needed yet).
- Small animated bars should pulse next to the title while playing.
- Switch to the **Lyrics** tab — placeholder lines highlight in sync
  with playback position.
- Under the controls, click the image-download icon — a PNG share
  card should download with the track's title and artist.
- With `prefers-reduced-motion` enabled in your OS/browser, the spin,
  pulse, and visualizer animations should stop.

## Verifying Phase 5

```bash
# Run the library migration
npm run prisma:migrate --workspace=apps/api -- --name add_library

# Like a song, then confirm it shows up
curl -i -X POST http://localhost:4000/api/songs/<songId>/like \
  -H "Authorization: Bearer <accessToken>"
curl http://localhost:4000/api/me/likes \
  -H "Authorization: Bearer <accessToken>"

# Create a playlist and add a song to it
curl -X POST http://localhost:4000/api/playlists \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Demo Mix"}'

curl -X POST http://localhost:4000/api/playlists/<playlistId>/songs \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"songId":"<songId>"}'

# Record a couple of plays, then check the personalized home feed
curl -i -X POST http://localhost:4000/api/me/history/<songId> \
  -H "Authorization: Bearer <accessToken>"
curl http://localhost:4000/api/discover/home \
  -H "Authorization: Bearer <accessToken>"
```

In the browser: log in, land on `/home` — you should see "Continue
listening" / "Made for you" / "Trending now" shelves built from real
data (empty shelves are expected on a fresh account until you've
played something). On any album/artist page or in the full-screen
player, click the heart icon to like a track — it should fill in
immediately — and the list icon to add the track to one of your
playlists.

## Verifying Phase 5.1 (app shell, library UI)

No API or database changes — this pass is front-end only.

```bash
npm install            # react-query / framer-motion were already deps
npm run dev --workspace=apps/web
```

Walk through:

- **`/` as a guest** — landing page with the spinning record and a playable
  "Trending now" shelf. **`/` while logged in** — a brief splash, then a
  redirect to `/home` (no landing flash).
- **Guarded routes** — open `/library` or `/home` logged out: you're sent to
  `/login?next=/library` and returned there after signing in.
- **Shell** — ≥768px: sidebar (Home / Search / Library, your playlists,
  "+" to create) and top bar with account menu. <768px: floating pill nav
  at the bottom; the mini-player sits above it.
- **Library** (`/library`) — tabs for Playlists, Liked songs, Albums,
  Artists; skeletons while loading, designed empty states, "Load more".
- **Playlist** (`/playlist/<slug>`) — mosaic cover, play, edit details,
  public/private toggle, delete, move up/down, remove; non-owners get
  "Save to library". Save an album/artist from its page and it appears in
  Library.
- **Likes** — hearts you've already given now render filled on load.

Unit tests for the new pure helpers (`nav`, `cover`, `format`) live in
`apps/web/src/lib/__tests__`.

## Verifying Phase 5.2 (keyboard shortcuts, editable queue, RTL/i18n)

No API or database changes — this pass is front-end only.

```bash
npm install
npm run dev --workspace=apps/web
```

Walk through:

- **Keyboard shortcuts** — anywhere except a text field: `Space` play/pause,
  `←`/`→` seek 5s, `Shift+←`/`Shift+→` previous/next track, `↑`/`↓` volume,
  `M` mute, `S` shuffle, `R` cycle repeat, `Q` toggle the queue panel, `F`
  toggle the full-screen player, `?` open the shortcuts help dialog, `Esc`
  closes whichever panel/dialog is topmost. Shortcuts are silent while
  focus is inside an `<input>`, `<textarea>`, `<select>` or a
  contenteditable element, and never fire alongside Ctrl/Cmd/Alt so they
  don't fight browser shortcuts.
- **Editable queue** — open the queue (`Q` or the queue icon in the desktop
  player bar): drag a row to reorder it, use the ↑/↓ chevrons, or focus a
  row and press `Alt+↑`/`Alt+↓`; remove a track with the ✕; "Clear
  upcoming" drops everything after the currently playing track without
  interrupting playback. From any track list, the "add to queue" icon
  (visible on hover) queues that song to play next.
- **RTL / i18n** — the language toggle in the top bar switches between
  English and Persian (فارسی). Persian flips the whole layout to RTL
  (sidebar, queue panel, search field, back/forward chevrons all mirror
  correctly) and persists across reloads with no layout flash. New locales
  go in `apps/web/src/lib/i18n/locales/`; `fa.ts` is type-checked against
  `en.ts`'s shape, so a missing key is a build error, not a silent
  fallback.

Unit tests for the new pure helpers (`shortcuts`, `i18n/translate`) live in
`apps/web/src/lib/__tests__` and `apps/web/src/lib/i18n/__tests__`; the new
queue actions (`removeFromQueue`, `moveInQueue`, `addToQueue`,
`clearUpcoming`) are covered in `apps/web/src/store/__tests__/player-store.spec.ts`.

## Verifying Phase 6 (search & discovery)

```bash
npm run prisma:migrate --workspace=apps/api -- --name add_search
npm install
npm run dev
```

Walk through:

- **Cmd+K palette** — press `Cmd+K` (macOS) or `Ctrl+K` (Windows/Linux)
  anywhere in the app, including while a text field is focused, or click
  the search field in the top bar. Type a few characters: results appear
  after a short pause (debounced, not one request per keystroke — watch
  the Network tab), grouped as Songs / Artists / Albums / Playlists.
  `↑`/`↓` move the highlight across every row and the "View all results
  for…" footer, `Enter` opens the highlighted one, `Esc` closes the
  palette. Before typing anything, it shows your recent searches instead.
- **`/search` page** — reachable from the sidebar/bottom nav (no longer
  marked "soon"), or via "View all results for…" in the palette. Tabs
  filter by type; the query is reflected in the URL (`?q=`) so a search is
  shareable and survives a refresh; empty and no-results states are
  designed, not blank.
- **Fuzzy matching** — a typo (e.g. one swapped letter in a song title)
  still finds the right result — that's `pg_trgm`, not exact substring
  matching.
- **Recent searches persist** — as a guest, search for something, reload
  the page, open the palette again: it's still there (localStorage). Log
  in and it switches to the server-backed list (`search_history` table),
  which follows the account across devices/browsers.
- **Rate limiting** — type very fast for a sustained burst; the search
  endpoint returns `429` well before the rest of the API would, since
  `GET /search` carries its own tighter throttle (see `docs/api.md`).

## Testing

```bash
npm run test --workspace=apps/api        # unit tests
npm run test:e2e --workspace=apps/api    # e2e (needs Postgres running)
```

## Type checking & linting

```bash
npm run typecheck
npm run lint
```
