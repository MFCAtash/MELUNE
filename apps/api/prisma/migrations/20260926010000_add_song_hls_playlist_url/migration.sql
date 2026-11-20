-- AlterTable
-- Adds the (nullable) HLS master-playlist URL populated by the async
-- audio-transcode worker once it finishes processing a song's audio.
-- Nullable by design: rows created before this migration, and any song
-- whose transcode job fails, simply keep playing from `audioUrl` — see
-- docs/architecture.md.
ALTER TABLE "songs" ADD COLUMN "hlsPlaylistUrl" TEXT;
