#!/usr/bin/env bash
# =============================================================================
# MELUNE — mirror the MinIO bucket to a local directory (and optionally offsite)
# =============================================================================
# Audio uploads are the only data that cannot be regenerated from Postgres, so
# back them up alongside the database dump.
#
# cron (weekly, Sunday 04:00 UTC):
#   0 4 * * 0 APP_DIR=/opt/melune /opt/melune/scripts/deploy/backup-minio.sh >> /var/log/melune-backup.log 2>&1
#
# Environment:
#   APP_DIR          repo checkout            (default /opt/melune)
#   BACKUP_DIR       destination              (default /var/backups/melune/media)
#   RETENTION_DAYS   not applied here — `mc mirror` keeps a single snapshot.
#   RCLONE_REMOTE    optional offsite target (e.g. b2:melune-backups/media)
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/melune}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/melune/media}"

cd "$APP_DIR"
[ -f .env.production ] || { echo "ERROR: .env.production missing" >&2; exit 1; }

COMPOSE=(docker compose --env-file .env.production -f docker-compose.prod.yml)
# compose project name is declared as `name: melune` in docker-compose.prod.yml
NETWORK="melune_internal"

ACCESS_KEY="$(grep -E '^STORAGE_ACCESS_KEY=' .env.production | head -n1 | cut -d= -f2-)"
SECRET_KEY="$(grep -E '^STORAGE_SECRET_KEY=' .env.production | head -n1 | cut -d= -f2-)"
BUCKET="$(grep -E '^STORAGE_BUCKET=' .env.production | head -n1 | cut -d= -f2-)"
BUCKET="${BUCKET:-melune-music}"

[ -n "$ACCESS_KEY" ] && [ -n "$SECRET_KEY" ] || {
  echo "ERROR: STORAGE_ACCESS_KEY/STORAGE_SECRET_KEY missing from .env.production" >&2
  exit 1
}

mkdir -p "$BACKUP_DIR"
chmod 700 "$(dirname "$BACKUP_DIR")" || true

echo "==> Mirroring $BUCKET -> $BACKUP_DIR"
docker run --rm \
  --network "$NETWORK" \
  -e MC_HOST_source="http://${ACCESS_KEY}:${SECRET_KEY}@minio:9000" \
  -v "${BACKUP_DIR}:/backup" \
  minio/mc:RELEASE.2024-01-16T16-06-34Z \
  mirror --overwrite --preserve source/"$BUCKET" /backup

if command -v rclone >/dev/null 2>&1 && [ -n "${RCLONE_REMOTE:-}" ]; then
  echo "==> Uploading media to $RCLONE_REMOTE"
  rclone sync --immutable "$BACKUP_DIR" "$RCLONE_REMOTE"
fi

echo "==> Media backup complete ($(du -sh "$BACKUP_DIR" | cut -f1))"
