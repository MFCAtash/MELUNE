#!/usr/bin/env bash
# =============================================================================
# MELUNE — generate .env.production for a chosen domain
# =============================================================================
# Turns the template into a ready-to-run production env file:
#   - sets DOMAIN / MEDIA_DOMAIN / every public URL consistently
#   - fills POSTGRES_PASSWORD / JWT_ACCESS_SECRET / MinIO keys with random values
#   - keeps DATABASE_URL and POSTGRES_PASSWORD identical (required)
#   - picks Caddyfile.origin when the Cloudflare Origin certificate exists,
#     otherwise the Let's Encrypt Caddyfile
#   - validates the result with `docker compose config`
#
# Usage (from the repo root, on the server or locally):
#
#   ./scripts/deploy/configure-domain.sh music.melune.app
#   MEDIA_DOMAIN=music-media.melune.app ./scripts/deploy/configure-domain.sh music.melune.app
#   ./scripts/deploy/configure-domain.sh --force --print melune.fm admin@melune.fm
#
# Media host defaults:
#   - apex / two-label domain  -> media.<domain>        (e.g. media.melune.fm)
#   - deeper subdomain         -> <first>-media.<rest>  (e.g. music-media.melune.app)
# Cloudflare's free Universal SSL covers only `*.<zone>` (one level), so the
# second form is required for deployments under an existing subdomain.
#
# Options:
#   --force    overwrite an existing .env.production
#   --print    also print the generated file (secrets included!) to stdout
#
# Requires: openssl (Docker is optional; validation is skipped if missing).
# =============================================================================
set -euo pipefail

FORCE=0
PRINT=0
ARGS=()

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --print) PRINT=1 ;;
    -h|--help)
      sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
    *)
      ARGS+=("$arg")
      ;;
  esac
done

DOMAIN="${ARGS[0]:-}"
EMAIL="${ARGS[1]:-}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: $0 [--force] [--print] <domain> [acme-email]" >&2
  echo "Example: $0 music.melune.app" >&2
  exit 1
fi

# Lowercase, strip scheme / trailing slash / leading www. just in case someone
# pastes "https://www.example.com/".
DOMAIN="$(printf '%s' "$DOMAIN" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's#^https?://##; s#/+$##; s#^www\.##')"

if ! printf '%s' "$DOMAIN" | grep -Eq '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'; then
  echo "ERROR: '$DOMAIN' is not a valid domain name." >&2
  exit 1
fi

EMAIL="${EMAIL:-admin@$DOMAIN}"

# Derive the media host unless the caller provided one. Three or more labels
# means "music.melune.app"-style, where media.music.melune.app would be two
# levels below the zone and outside the free Universal SSL certificate.
if [ -z "${MEDIA_DOMAIN:-}" ]; then
  case "$DOMAIN" in
    *.*.*) MEDIA_DOMAIN="${DOMAIN%%.*}-media.${DOMAIN#*.}" ;;
    *)     MEDIA_DOMAIN="media.$DOMAIN" ;;
  esac
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$APP_DIR"

TEMPLATE=".env.production.example"
TARGET=".env.production"

if [ ! -f "$TEMPLATE" ]; then
  echo "ERROR: $APP_DIR/$TEMPLATE not found — is this the MELUNE repository?" >&2
  exit 1
fi

if [ -f "$TARGET" ] && [ "$FORCE" -ne 1 ]; then
  echo "ERROR: $TARGET already exists. Re-run with --force to overwrite (it will be re-generated)." >&2
  exit 1
fi

BUCKET="$(sed -n 's/^STORAGE_BUCKET=//p' "$TEMPLATE" | head -n1)"
BUCKET="${BUCKET:-melune-music}"

# ---------------------------------------------------------------------------
# Random secrets (URL-safe: hex only, so they are safe inside DATABASE_URL)
# ---------------------------------------------------------------------------
need_openssl() {
  command -v openssl >/dev/null 2>&1 || {
    echo "ERROR: openssl is required to generate secrets." >&2
    echo "       Install it with: sudo apt-get install -y openssl" >&2
    exit 1
  }
}
need_openssl

PG_PASSWORD="$(openssl rand -hex 24)"
JWT_SECRET="$(openssl rand -hex 48)"          # 96 chars, well above the 32 minimum
MINIO_ACCESS="$(openssl rand -hex 20)"
MINIO_SECRET="$(openssl rand -hex 32)"

# Caddy TLS mode: use the Cloudflare Origin certificate when it is on disk.
if [ -f "infra/caddy/origin.pem" ] && [ -f "infra/caddy/origin.key" ]; then
  CADDY_MODE="Caddyfile.origin"
else
  CADDY_MODE="Caddyfile"
fi

# ---------------------------------------------------------------------------
# Render the env file
# ---------------------------------------------------------------------------
# Each substitution targets one KEY= line, so nothing else in the file (URLs,
# comments, bucket names) can be mangled by an accidental global replace.
umask 077
sed \
  -e "s|^DOMAIN=.*|DOMAIN=$DOMAIN|" \
  -e "s|^MEDIA_DOMAIN=.*|MEDIA_DOMAIN=$MEDIA_DOMAIN|" \
  -e "s|^ACME_EMAIL=.*|ACME_EMAIL=$EMAIL|" \
  -e "s|^CADDYFILE=.*|CADDYFILE=$CADDY_MODE|" \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$PG_PASSWORD|" \
  -e "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://melune:$PG_PASSWORD@postgres:5432/melune?schema=public\\&connection_limit=10\\&pool_timeout=20|" \
  -e "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$JWT_SECRET|" \
  -e "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=https://$DOMAIN|" \
  -e "s|^CORS_ORIGIN=.*|CORS_ORIGIN=https://$DOMAIN|" \
  -e "s|^WEB_APP_URL=.*|WEB_APP_URL=https://$DOMAIN|" \
  -e "s|^STORAGE_ENDPOINT=.*|STORAGE_ENDPOINT=https://$MEDIA_DOMAIN|" \
  -e "s|^STORAGE_PUBLIC_URL=.*|STORAGE_PUBLIC_URL=https://$MEDIA_DOMAIN/$BUCKET|" \
  -e "s|^STORAGE_ACCESS_KEY=.*|STORAGE_ACCESS_KEY=$MINIO_ACCESS|" \
  -e "s|^STORAGE_SECRET_KEY=.*|STORAGE_SECRET_KEY=$MINIO_SECRET|" \
  "$TEMPLATE" > "$TARGET"

chmod 600 "$TARGET"

# ---------------------------------------------------------------------------
# Validate
# ---------------------------------------------------------------------------
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  if docker compose --env-file "$TARGET" -f docker-compose.prod.yml config -q >/dev/null 2>&1; then
    echo "==> docker compose config: OK"
  else
    echo "WARNING: docker compose config rejected the generated file:" >&2
    docker compose --env-file "$TARGET" -f docker-compose.prod.yml config >/dev/null || true
  fi
else
  echo "==> Docker not available here; skipping compose validation."
fi

if [ "$PRINT" -eq 1 ]; then
  echo "----- BEGIN $TARGET (contains secrets) -----"
  cat "$TARGET"
  echo "----- END $TARGET -----"
fi

cat <<EOF

============================================================
.env.production written for: $DOMAIN

  App         https://$DOMAIN
  Media       https://$MEDIA_DOMAIN
  TLS mode    $CADDY_MODE
  ACME email  $EMAIL

Secrets were generated with openssl and are only in $TARGET
(mode 600). Back this file up in your password manager: losing
POSTGRES_PASSWORD makes an existing database unreachable.

Cloudflare DNS (zone already exists — add only these two):
  A      music       <VM public IP>   Proxied
  CNAME  <media>     $DOMAIN         Proxied
  (the media host above is the first label of MEDIA_DOMAIN)

Cloudflare SSL/TLS mode: Full (strict)

Origin certificate (recommended):
  SSL/TLS -> Origin Server -> Create Certificate
  Hostnames: $DOMAIN, $MEDIA_DOMAIN
  Save as infra/caddy/origin.pem and infra/caddy/origin.key,
  then re-run this script with --force (it will switch CADDYFILE
  to Caddyfile.origin automatically).

First boot:
  docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
============================================================
EOF
