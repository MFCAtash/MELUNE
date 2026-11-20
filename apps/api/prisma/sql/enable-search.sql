-- Phase 6 — Search: optional full-text performance indexes.
--
-- SearchService already works without this file: the trigram GIN indexes
-- declared in schema.prisma (via `@@index(... type: Gin)`) cover the
-- similarity()/%/ILIKE side of every query, and Postgres can still use
-- them for `to_tsvector('simple', col) @@ plainto_tsquery(...)` via a
-- sequential-scan fallback at this catalog size.
--
-- Once a table has enough rows that EXPLAIN ANALYZE shows a seq scan on
-- the full-text branch, run this once (`psql $DATABASE_URL -f
-- apps/api/prisma/sql/enable-search.sql`) to add matching expression GIN
-- indexes. Prisma's schema DSL can't declare an index on a function call,
-- which is why this lives as plain SQL instead of in schema.prisma.
CREATE INDEX IF NOT EXISTS songs_title_fts_idx
  ON songs USING GIN (to_tsvector('simple', title));

CREATE INDEX IF NOT EXISTS artists_name_fts_idx
  ON artists USING GIN (to_tsvector('simple', name));

CREATE INDEX IF NOT EXISTS albums_title_fts_idx
  ON albums USING GIN (to_tsvector('simple', title));

CREATE INDEX IF NOT EXISTS playlists_title_fts_idx
  ON playlists USING GIN (to_tsvector('simple', title))
  WHERE "isPublic" = true AND "deletedAt" IS NULL;
