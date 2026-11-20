#!/usr/bin/env bash
# =============================================================================
# MELUNE — rewrite local media URLs in the database for the public domain
# =============================================================================
# Demo/seeded rows store absolute URLs like:
#   http://localhost:3000/audio-real/bad-guy.m4a
#   http://localhost:3000/covers-real/bad-guy.jpg
#   http://localhost:9000/melune/audio/<uuid>.mp3
#
# After restoring a local dump onto the server those hosts are unreachable, so
# every audio/cover/avatar reference must point at the public origin (web
# assets) or the media subdomain (MinIO objects).
#
# Usage:
#   ./scripts/deploy/fix-media-urls.sh            # dry run, prints counts
#   ./scripts/deploy/fix-media-urls.sh --apply    # writes the changes
#
# Environment overrides:
#   OLD_WEB   (default http://localhost:3000)
#   NEW_WEB   (default https://$DOMAIN from .env.production)
#   OLD_MEDIA (default http://localhost:9000)
#   NEW_MEDIA (default https://media.$DOMAIN)
#   OLD_BUCKET/NEW_BUCKET (default melune -> STORAGE_BUCKET)
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/melune}"
APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

cd "$APP_DIR"

DOMAIN="${DOMAIN:-$(grep -E '^DOMAIN=' .env.production | head -n1 | cut -d= -f2-)}"
MEDIA_DOMAIN="${MEDIA_DOMAIN:-$(grep -E '^MEDIA_DOMAIN=' .env.production | head -n1 | cut -d= -f2-)}"
BUCKET="${STORAGE_BUCKET:-$(grep -E '^STORAGE_BUCKET=' .env.production | head -n1 | cut -d= -f2-)}"

OLD_WEB="${OLD_WEB:-http://localhost:3000}"
NEW_WEB="${NEW_WEB:-https://${DOMAIN}}"
OLD_MEDIA="${OLD_MEDIA:-http://localhost:9000}"
# MEDIA_DOMAIN is a separate variable because the media host is not always
# media.<DOMAIN> (e.g. music.melune.app -> music-media.melune.app).
NEW_MEDIA="${NEW_MEDIA:-https://${MEDIA_DOMAIN:-media.${DOMAIN}}}"
OLD_BUCKET="${OLD_BUCKET:-melune}"
NEW_BUCKET="${NEW_BUCKET:-${BUCKET:-melune-music}}"

COMPOSE=(docker compose --env-file .env.production -f docker-compose.prod.yml)
PG_USER="$("${COMPOSE[@]}" exec -T postgres printenv POSTGRES_USER)"
PG_DB="$("${COMPOSE[@]}" exec -T postgres printenv POSTGRES_DB)"

echo "Web:   $OLD_WEB  ->  $NEW_WEB"
echo "Media: $OLD_MEDIA/$OLD_BUCKET  ->  $NEW_MEDIA/$NEW_BUCKET"
echo

if [ "$APPLY" -eq 0 ]; then
  echo "DRY RUN — counting rows (pass --apply to write)."
  "${COMPOSE[@]}" exec -T postgres psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 \
    -v old="$OLD_WEB" -v oldm="$OLD_MEDIA" <<'SQL'
SELECT 'songs.audioUrl' AS column, count(*) FROM songs WHERE "audioUrl" LIKE '%' || :'old' || '%'
UNION ALL SELECT 'songs.coverUrl', count(*) FROM songs WHERE "coverUrl" LIKE '%' || :'old' || '%'
UNION ALL SELECT 'songs.hlsPlaylistUrl', count(*) FROM songs WHERE "hlsPlaylistUrl" LIKE '%' || :'oldm' || '%'
UNION ALL SELECT 'albums.coverUrl', count(*) FROM albums WHERE "coverUrl" LIKE '%' || :'old' || '%'
UNION ALL SELECT 'artists.imageUrl', count(*) FROM artists WHERE "imageUrl" LIKE '%' || :'old' || '%'
UNION ALL SELECT 'playlists.coverUrl', count(*) FROM playlists WHERE "coverUrl" LIKE '%' || :'old' || '%'
UNION ALL SELECT 'users.avatarUrl', count(*) FROM users WHERE "avatarUrl" LIKE '%' || :'old' || '%';
SQL
  exit 0
fi

echo "Applying…"
"${COMPOSE[@]}" exec -T postgres psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 \
  -v old="$OLD_WEB" -v new="$NEW_WEB" \
  -v oldm="$OLD_MEDIA" -v newm="$NEW_MEDIA" \
  -v oldb="$OLD_BUCKET" -v newb="$NEW_BUCKET" <<'SQL'
BEGIN;

-- 1. MinIO object URLs: rewrite bucket first so the host rewrite cannot
--    produce a URL with the old bucket name.
UPDATE songs SET "audioUrl" = replace("audioUrl", :'oldm' || '/' || :'oldb', :'newm' || '/' || :'newb')
 WHERE "audioUrl" LIKE '%' || :'oldm' || '/' || :'oldb' || '%';
UPDATE songs SET "coverUrl" = replace("coverUrl", :'oldm' || '/' || :'oldb', :'newm' || '/' || :'newb')
 WHERE "coverUrl" LIKE '%' || :'oldm' || '/' || :'oldb' || '%';
UPDATE songs SET "hlsPlaylistUrl" = replace("hlsPlaylistUrl", :'oldm' || '/' || :'oldb', :'newm' || '/' || :'newb')
 WHERE "hlsPlaylistUrl" LIKE '%' || :'oldm' || '/' || :'oldb' || '%';
UPDATE albums SET "coverUrl" = replace("coverUrl", :'oldm' || '/' || :'oldb', :'newm' || '/' || :'newb')
 WHERE "coverUrl" LIKE '%' || :'oldm' || '/' || :'oldb' || '%';
UPDATE artists SET "imageUrl" = replace("imageUrl", :'oldm' || '/' || :'oldb', :'newm' || '/' || :'newb')
 WHERE "imageUrl" LIKE '%' || :'oldm' || '/' || :'oldb' || '%';
UPDATE playlists SET "coverUrl" = replace("coverUrl", :'oldm' || '/' || :'oldb', :'newm' || '/' || :'newb')
 WHERE "coverUrl" LIKE '%' || :'oldm' || '/' || :'oldb' || '%';
UPDATE users SET "avatarUrl" = replace("avatarUrl", :'oldm' || '/' || :'oldb', :'newm' || '/' || :'newb')
 WHERE "avatarUrl" LIKE '%' || :'oldm' || '/' || :'oldb' || '%';

-- 2. Remaining localhost MinIO references (any bucket).
UPDATE songs SET "audioUrl" = replace("audioUrl", :'oldm', :'newm') WHERE "audioUrl" LIKE '%' || :'oldm' || '%';
UPDATE songs SET "coverUrl" = replace("coverUrl", :'oldm', :'newm') WHERE "coverUrl" LIKE '%' || :'oldm' || '%';
UPDATE songs SET "hlsPlaylistUrl" = replace("hlsPlaylistUrl", :'oldm', :'newm') WHERE "hlsPlaylistUrl" LIKE '%' || :'oldm' || '%';
UPDATE albums SET "coverUrl" = replace("coverUrl", :'oldm', :'newm') WHERE "coverUrl" LIKE '%' || :'oldm' || '%';
UPDATE artists SET "imageUrl" = replace("imageUrl", :'oldm', :'newm') WHERE "imageUrl" LIKE '%' || :'oldm' || '%';
UPDATE playlists SET "coverUrl" = replace("coverUrl", :'oldm', :'newm') WHERE "coverUrl" LIKE '%' || :'oldm' || '%';
UPDATE users SET "avatarUrl" = replace("avatarUrl", :'oldm', :'newm') WHERE "avatarUrl" LIKE '%' || :'oldm' || '%';

-- 3. Web-served demo assets (apps/web/public/*).
UPDATE songs SET "audioUrl" = replace("audioUrl", :'old', :'new') WHERE "audioUrl" LIKE '%' || :'old' || '%';
UPDATE songs SET "coverUrl" = replace("coverUrl", :'old', :'new') WHERE "coverUrl" LIKE '%' || :'old' || '%';
UPDATE albums SET "coverUrl" = replace("coverUrl", :'old', :'new') WHERE "coverUrl" LIKE '%' || :'old' || '%';
UPDATE artists SET "imageUrl" = replace("imageUrl", :'old', :'new') WHERE "imageUrl" LIKE '%' || :'old' || '%';
UPDATE playlists SET "coverUrl" = replace("coverUrl", :'old', :'new') WHERE "coverUrl" LIKE '%' || :'old' || '%';
UPDATE users SET "avatarUrl" = replace("avatarUrl", :'old', :'new') WHERE "avatarUrl" LIKE '%' || :'old' || '%';

COMMIT;
SQL

echo
echo "==> Verifying no localhost URLs remain"
"${COMPOSE[@]}" exec -T postgres psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'songs' AS t, count(*) FROM songs
 WHERE "audioUrl" LIKE '%localhost%' OR "coverUrl" LIKE '%localhost%' OR "hlsPlaylistUrl" LIKE '%localhost%'
UNION ALL SELECT 'albums', count(*) FROM albums WHERE "coverUrl" LIKE '%localhost%'
UNION ALL SELECT 'artists', count(*) FROM artists WHERE "imageUrl" LIKE '%localhost%'
UNION ALL SELECT 'playlists', count(*) FROM playlists WHERE "coverUrl" LIKE '%localhost%'
UNION ALL SELECT 'users', count(*) FROM users WHERE "avatarUrl" LIKE '%localhost%';
SQL

echo "==> Done"
