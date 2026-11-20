-- Synced lyrics (LRC). One optional document per song; the JSONB `lines`
-- column holds the already-parsed, time-sorted line array the web player
-- renders, while `content` preserves the original upload verbatim.
CREATE TABLE "lyrics" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'und',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lyrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lyrics_songId_key" ON "lyrics"("songId");

ALTER TABLE "lyrics" ADD CONSTRAINT "lyrics_songId_fkey" FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
