# Phase 8.1 — Plasma UI, offline downloads, Web Push

Follow-up to `CHANGES-phase8.md` (Redis, real storage, in-app
notifications, e2e coverage). This pass builds directly on that: real
storage → offline downloads become possible; in-app notifications →
Web Push becomes a delivery channel for the same events.

## 8. Plasma UI (decorative only)
- New `components/player/plasma-background.tsx`: two large, heavily
  blurred radial-gradient blobs, absolutely positioned behind
  `FullScreenPlayer`'s existing artwork/ambient-color backdrop.
- Scope kept intentionally narrow, per spec:
  - **One element**: only `FullScreenPlayer`'s backdrop. Nothing else
    in the shell changed.
  - **Desktop only**: `hidden lg:block` — the phone layout is already
    a tight `max-w-md` column of vinyl + glass panels; this doesn't
    render there at all.
  - **Behind `prefers-reduced-motion`**: the blobs are static by
    default and only animate via Tailwind's `motion-safe:` variant
    (`animate-plasma-drift-a` / `-b`, new keyframes in
    `tailwind.config.ts`), which compiles to
    `@media (prefers-reduced-motion: no-preference)`. No JS media-query
    check needed — someone with reduced motion set at the OS level
    never receives the animation.
  - `aria-hidden` + `pointer-events-none`: ambient light, not content.
- Colored from the same per-track `ambientColor` the backdrop already
  computes (`useAmbientColor`), so it reads as one coherent glow.

## 4. Real audio streaming + offline
### Online playback
Already effectively solved by (the original) Phase 8: songs are served
directly from S3/MinIO's presigned/public URLs (`StorageService`), and
S3-compatible storage serves `Range` requests natively — `<audio>`
seeking already gets partial-content behavior for free, no proxy or
HLS repackaging needed. No code change required here; multiple
*bitrates* (true adaptive streaming) would still need HLS/DASH and
stays out of scope for this pass, same as noted in
`docs/architecture.md`.

### Offline downloads
- `lib/offline-store.ts`: IndexedDB (not localStorage — see the
  file's own doc comment for why) cache of downloaded tracks. DB
  `melune-offline`, store `tracks`, keyed by song id, storing the whole
  audio `Blob` plus small metadata (title/artist/cover/size/cachedAt).
  Exposes `downloadTrackOffline` (streams the fetch with a progress
  callback), `deleteTrackOffline`, `isTrackDownloaded`,
  `getOfflineObjectUrl`, `listDownloadedTracks`, and a tiny pub/sub
  (`subscribeOfflineChanges`) so UI re-renders on change.
- `hooks/use-offline-track.ts`: per-track download/downloading/error
  state wrapping the store above.
- `components/player/song-more-menu.tsx`: new "Download for
  offline" / "Remove download" row (with a spinner mid-download).
- `components/player/player-engine.tsx`: on track load, checks
  IndexedDB first and plays from a `blob:` object URL when a
  downloaded copy exists (revoked on track change/unmount) — falls
  back to the remote `audioUrl` otherwise. This is the primary path:
  it works fully offline and skips the network even when online.
- `public/sw.js`: extended (previously explicitly out of scope — see
  the file's own Phase 6.7 history in its header comment) with a
  second, best-effort path: for cross-origin audio requests,
  network-first then IndexedDB fallback on failure, for the case
  where a request reaches the network layer outside the player's own
  blob-URL logic. Duplicates `offline-store.ts`'s read-only IndexedDB
  schema by hand (no bundler in this file to `import` it) — keep
  `DB_NAME`/`DB_VERSION`/`STORE` in sync between the two files.
- **CORS note**: unlike `<audio src>` playback, `fetch()`-ing the
  audio bytes to store them requires the storage host to send CORS
  headers for the web app's origin. `docker-compose.yml`'s `minio`
  service now sets `MINIO_API_CORS_ALLOW_ORIGIN` from `WEB_APP_URL`
  for local dev; a real S3/CDN deployment needs the equivalent bucket/
  distribution CORS rule (allow `GET`, origin = the web app's URL).

## 5. Push notifications
- **Schema**: new `PushSubscription` model (`endpoint` unique, `p256dh`
  + `auth` keys, `userId`) — one row per subscribed browser/device.
- **API** (`src/push/`): `PushService` wraps `web-push`, configured
  from `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (a
  no-op, logged once, until those are set — mirrors `StorageService`'s
  `configured` pattern). `PushController` exposes
  `POST /me/push/subscribe` and `DELETE /me/push/subscribe`
  (authenticated, under the existing global `JwtAuthGuard`).
  `npm run generate:vapid` (new script, `scripts/generate-vapid-keys.js`)
  prints a fresh key pair.
- **Wired into the existing notification events, not new ones**:
  `NotificationsService.create` (used by `welcome`) and
  `notifyNewRelease` now call `PushService.sendToUser` /
  `sendToUsers` right after writing the in-app `Notification` row(s).
  Push is a best-effort side channel — the in-app row is still the
  source of truth, and a push failure (including "user has no
  subscriptions" or "VAPID not configured") never affects the
  request that triggered it. A 404/410 from the browser's push
  service (subscription gone for good) deletes that row instead of
  retrying forever.
- **Web**: `hooks/use-push-notifications.ts` + a topbar bell
  (`components/pwa/push-notifications-button.tsx`, next to
  `ThemeToggle`) that requests `Notification` permission and calls
  `pushManager.subscribe` explicitly on click — never auto-prompts on
  load. `lib/push.ts` holds the standard VAPID-key base64→Uint8Array
  conversion. `public/sw.js` gained `push` (shows the notification)
  and `notificationclick` (focuses an existing tab or opens one at the
  payload's `url`) listeners.
- **Env**: `.env.example` gained `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

## Setup checklist
1. `cd apps/api && npm install` (adds `web-push`).
2. `npm run generate:vapid`, paste the four printed lines into `.env`
   (both API and web vars — same key pair).
3. `npx prisma migrate dev` (new `PushSubscription` table).
4. Local MinIO: `docker compose up -d` picks up the new
   `MINIO_API_CORS_ALLOW_ORIGIN` automatically; production storage
   needs the equivalent CORS rule added manually.

## Explicitly out of scope this pass
- Multi-bitrate/adaptive streaming (HLS/DASH) — plain Range requests
  cover the ask ("maybe HLS isn't needed yet unless multiple
  qualities are wanted").
- A third-party push provider (FCM/OneSignal/etc) — direct
  browser-vendor delivery via VAPID only, per the request.
- A full in-app notification inbox UI — `NotificationsController`
  already existed pre-Phase-8 and still has no frontend consumer;
  only the push *delivery* side was added here.
