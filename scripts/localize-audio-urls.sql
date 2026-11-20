-- Point every song at the locally-hosted audio files (apps/web/public/audio)
-- so playback is same-origin: faster start, no external dependency, and the
-- Web Audio analyser (Sonic Canvas) is never CORS-tainted into silence.
UPDATE songs
SET "audioUrl" = replace(
  "audioUrl",
  'https://www.soundhelix.com/examples/mp3/',
  'http://localhost:3000/audio/'
)
WHERE "audioUrl" LIKE 'https://www.soundhelix.com/examples/mp3/%';
