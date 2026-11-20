# Media assets: Git LFS and R2

`apps/web/public` contains the demo catalog: 74 `.m4a` tracks, 28 `.mp3`
samples and 86 cover images. These are the largest files in the repository.

## Current state

All of them are tracked with **Git LFS** — see `.gitattributes`. The main git
tree stores only small pointer files; the binaries live in GitHub LFS storage.
This keeps `git clone` and CI checkouts fast.

> Git history still contains the original binaries from before the LFS
> migration. A history rewrite (`git filter-repo`) is deliberately **not**
> performed because it would invalidate every existing clone and fork.

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
4. In a follow-up commit, remove the LFS paths from `apps/web/public` and set
   `STORAGE_PUBLIC_URL` / `MEDIA_DOMAIN` in `.env.production`.

## Licensing note

The bundled demo tracks and cover images are from well-known artists and are
**not licensed for redistribution**. They exist only to make the demo run.
Before a public commercial launch, replace them with royalty-free material or
stream from a licensed catalog. The track filenames and seed data can stay the
same: replace the file contents in place and no code changes are required.
