#!/usr/bin/env bash
# =============================================================================
# MELUNE — restore a Postgres custom-format dump
# =============================================================================
# DESTRUCTIVE: --clean drops the existing objects before recreating them.
# Requires the literal flag --yes to run.
#
#   ./scripts/deploy/restore-postgres.sh --yes /var/backups/melune/melune-....dump
#
# Stop the app writers first to avoid a half-restored database:
#   docker compose --env-file .env.production -f docker-compose.prod.yml stop api transcode-worker
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/melune}"

if [ "${1:-}" != "--yes" ]; then
  echo "Refusing to run without --yes (this drops and recreates objects)." >&2
  echo "Usage: $0 --yes <dumpfile>" >&2
  exit 1
fi

DUMP="${2:-}"
if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo "ERROR: dump file not found: ${DUMP:-<empty>}" >&2
  exit 1
fi

cd "$APP_DIR"
COMPOSE=(docker compose --env-file .env.production -f docker-compose.prod.yml)

PG_USER="$("${COMPOSE[@]}" exec -T postgres printenv POSTGRES_USER)"
PG_DB="$("${COMPOSE[@]}" exec -T postgres printenv POSTGRES_DB)"

echo "==> Restoring $DUMP into $PG_DB as $PG_USER"
"${COMPOSE[@]}" exec -T postgres \
  pg_restore -U "$PG_USER" -d "$PG_DB" --clean --if-exists --no-owner --no-privileges \
  <"$DUMP"

echo "==> Restore complete"
echo "    Run scripts/deploy/fix-media-urls.sh next if the dump came from local dev."
