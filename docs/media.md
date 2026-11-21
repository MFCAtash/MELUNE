# Media assets: repository storage and R2

`apps/web/public` contains the demo catalog: 74 `.m4a` tracks, 28 `.mp3`
samples and 86 cover images. These are the largest files in the repository.
`docs/assets/` adds the README artwork and the 35 MB project demo video.

## Current state

The media is committed **directly to git** (no Git LFS). A Git LFS migration
was prepared and then reverted: LFS uploads failed authentication for this
repository, and leaving half the objects as pointers would have broken clones.
`.gitattributes` still marks every binary extension (`*.m4a`, `*.mp3`, `*.png`,
`*.mp4`, …) so diffs and merges never treat media as text, but the bytes
themselves live in the normal git object store. A fresh clone is therefore
large (about 340 MB including history).

> Git history contains the original binaries from before the attempted LFS
> migration. A history rewrite (`git filter-repo`) is deliberately **not**
> performed because it would invalidate every existing clone and fork. Treat
> the current history as append-only.

Adding another large demo video or lossless audio file should go through the
R2 path below rather than growing the clone further.

## Moving to R2 (recommended for production)

1. Create an R2 bucket and a public media hostname (one subdomain level, e.g.
   `music-media.melune.app`).
2. Export credentials and run:
   ```bash
   export R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=...
   export R2_BUCKET=melune-music R2_PUBLIC_URL=https://music-media.melune.app
   ./scripts/deploy/migrate-media-to-r2.sh
   ```
3. Rewrite stored URLs: `./scripts/deploy/fix-media-urls.sh --apply`.
4. In a follow-up commit, remove the media paths from `apps/web/public` and set
   `STORAGE_PUBLIC_URL` / `MEDIA_DOMAIN` in `.env.production`.

The README artwork and demo video are static documentation assets, not runtime
media: they can stay in `docs/assets/` (or move to the repository's release
assets) without touching the application code.

## Licensing note

The bundled demo tracks and cover images are from well-known artists and are
**not licensed for redistribution**. They exist only to make the demo run.
Before a public commercial launch, replace them with royalty-free material or
stream from a licensed catalog. The track filenames and seed data can stay the
same: replace the file contents in place and no code changes are required.
