#!/usr/bin/env bash
# =============================================================================
# MELUNE — Postgres backup (custom format, gzip-friendly, restore-able)
# =============================================================================
# Recommended cron (daily at 03:15 UTC):
#
#   15 3 * * * APP_DIR=/opt/melune /opt/melune/scripts/deploy/backup-postgres.sh >> /var/log/melune-backup.log 2>&1
#
# Environment:
#   APP_DIR         repo checkout      (default /opt/melune)
#   BACKUP_DIR      destination        (default /var/backups/melune)
#   RETENTION_DAYS  local retention    (default 14)
#   RCLONE_REMOTE   optional, e.g. "b2:melune-backups" — requires rclone
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/melune}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/melune}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

cd "$APP_DIR"

if [ ! -f .env.production ]; then
  echo "ERROR: $APP_DIR/.env.production not found" >&2
  exit 1
fi

COMPOSE=(docker compose --env-file .env.production -f docker-compose.prod.yml)

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

PG_USER="$("${COMPOSE[@]}" exec -T postgres printenv POSTGRES_USER)"
PG_DB="$("${COMPOSE[@]}" exec -T postgres printenv POSTGRES_DB)"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/melune-$STAMP.dump"
TMP="$OUT.part"

echo "==> Dumping $PG_DB as $PG_USER"
# -Fc = custom format: compressed, supports pg_restore --clean/--if-exists and
# selective restore. Written to a .part file first so a killed cron job can
# never leave a truncated file that looks valid.
"${COMPOSE[@]}" exec -T postgres \
  pg_dump -U "$PG_USER" -d "$PG_DB" --no-owner --no-privileges -Fc >"$TMP"

if [ ! -s "$TMP" ]; then
  echo "ERROR: dump is empty" >&2
  rm -f "$TMP"
  exit 1
fi

mv "$TMP" "$OUT"
chmod 600 "$OUT"

echo "==> Wrote $OUT ($(du -h "$OUT" | cut -f1))"

if command -v rclone >/dev/null 2>&1 && [ -n "${RCLONE_REMOTE:-}" ]; then
  echo "==> Uploading to $RCLONE_REMOTE"
  rclone copy --immutable "$OUT" "$RCLONE_REMOTE"
fi

echo "==> Pruning local dumps older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'melune-*.dump' \
  -mtime "+${RETENTION_DAYS}" -print -delete

echo "==> Backup complete"
