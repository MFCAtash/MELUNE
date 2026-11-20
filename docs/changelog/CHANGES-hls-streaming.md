# HLS / Adaptive Bitrate Streaming

Closes the gap explicitly called out in `CHANGES-phase8_1.md`'s "Real
audio streaming" section: direct-file playback already worked (S3/MinIO
serves `Range` requests natively), but true multi-*bitrate* adaptive
streaming needed HLS/DASH and was out of scope for that pass. This pass
adds it, fully optional/graceful on top of the existing direct-file path.

## What changed

### Schema
- `Song.hlsPlaylistUrl String?` — nullable HLS master-playlist URL.
  Migration: `apps/api/prisma/migrations/20260926010000_add_song_hls_playlist_url/`.
- `@melune/types`'s `Song` interface gained the matching optional field.

### API — queues the job, never runs ffmpeg itself
- `apps/api/src/queue/` (new): `queue.constants.ts` (queue/job names,
  `AudioTranscodeJobData`, the three constant bitrates) and
  `queue.module.ts` — a `@Global` module providing a BullMQ `Queue`
  producer on its own dedicated Redis connection (BullMQ needs
  `maxRetriesPerRequest: null`, different tuning than
  `CacheService`'s client).
- `StorageService.transcodeAudio(songId, sourceKey)` — enqueues one job
  (`jobId: transcode:<songId>`, so a re-upload replaces rather than
  duplicates pending work). Fire-and-forget: any failure to queue is
  logged and swallowed, never thrown.
- `SongsService.createRecord` and `SongsService.update` (when
  `audioUrl` actually changes) call it right after the DB write — the
  earliest point the API can reliably tie an uploaded object to a song,
  given presigned uploads never touch the API itself.

### Worker — the only place that needs ffmpeg
- `apps/api/src/queue/workers/audio-transcode.worker.ts` (new): a
  standalone BullMQ consumer (deliberately not a Nest app). Downloads
  the original audio, runs one `ffmpeg` invocation producing
  128k/192k/320k AAC HLS renditions + a master playlist
  (`-var_stream_map`), uploads the result to `hls/<songId>/` in the same
  bucket, and writes the resulting URL to `Song.hlsPlaylistUrl`. Any
  failure anywhere in this path is caught, logged, and simply leaves
  `hlsPlaylistUrl` unset.
- `infra/docker/worker.Dockerfile` (new) — same build as `api.Dockerfile`
  through the build stage, but the runtime image additionally
  `apk add`s `ffmpeg`. Neither the `api` nor `web` container needs it.
- `docker-compose.yml`: new `transcode-worker` service running that
  image. Stopping it (or never starting it) doesn't break anything —
  jobs just queue up in Redis and every song keeps playing from
  `audioUrl` in the meantime.

### Web — hls.js, with layered fallback
- `apps/web/src/components/player/player-engine.tsx`: when a track has
  `hlsPlaylistUrl`, uses `hls.js` (or native HLS on Safari/iOS) instead
  of the direct file; any fatal `hls.js` error, or no `hlsPlaylistUrl`
  at all, falls back to `audioUrl` exactly as before this change. The
  offline-download path (IndexedDB-cached blob) is untouched and still
  takes priority over both.

### Docs
- `docs/architecture.md`: new "Async Processing — Audio Transcode
  Queue (HLS / Adaptive Bitrate)" section.
- `docs/api.md`: notes `hlsPlaylistUrl` on Song responses.
- `.env.example`: optional `TRANSCODE_WORKER_CONCURRENCY`.

## Explicitly out of scope (same fail-open philosophy, not gaps to fix reactively)
- No backfill job for songs uploaded before this shipped — they simply
  have `hlsPlaylistUrl: null` forever, same as any failed transcode.
- No artist-facing "transcoding…" status/progress UI.
- Deleting a song doesn't clean up its `hls/<songId>/` bucket objects
  (only the original `audioUrl` object is cleaned up today, via
  `cleanupReplacedFile`) — same orphaned-object tradeoff soft-deletes
  already accept elsewhere in this codebase.
