#!/usr/bin/env bash
# Export MELUNE demo media to Cloudflare R2 (or any S3-compatible bucket),
# then rewrite the stored URLs so the app reads from the public media host.
#
# Required environment variables:
#   R2_ACCOUNT_ID      Cloudflare account id
#   R2_ACCESS_KEY_ID   R2 API token id
#   R2_SECRET_ACCESS_KEY R2 API token secret
#   R2_BUCKET          Bucket name (e.g. melune-music)
#   R2_PUBLIC_URL      Public bucket URL (e.g. https://music-media.melune.app)
#
# The repository keeps these files in Git LFS (see .gitattributes) so they
# do not bloat the main git tree. This script is the next step for moving
# them out of the repository entirely: upload once, then delete the LFS
# paths from a follow-up commit and keep only the seeded URLs.
set -euo pipefail

: "${R2_ACCOUNT_ID:?missing}"
: "${R2_ACCESS_KEY_ID:?missing}"
: "${R2_SECRET_ACCESS_KEY:?missing}"
: "${R2_BUCKET:?missing}"
: "${R2_PUBLIC_URL:?missing}"

ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
count=0

for dir in audio-real audio-full audio covers-real hero-covers; do
  src="$ROOT/apps/web/public/$dir"
  [ -d "$src" ] || continue
  for file in "$src"/*; do
    [ -f "$file" ] || continue
    key="$dir/$(basename "$file")"
    echo "uploading $key"
    aws --endpoint-url "$ENDPOINT" s3 cp "$file" "s3://$R2_BUCKET/$key" \
      --cache-control "public, max-age=31536000, immutable" --no-progress
    count=$((count + 1))
  done
done

echo "uploaded $count files to s3://$R2_BUCKET"
echo "Public base: $R2_PUBLIC_URL"
echo "Next: run ./scripts/deploy/fix-media-urls.sh --apply to rewrite stored URLs."
