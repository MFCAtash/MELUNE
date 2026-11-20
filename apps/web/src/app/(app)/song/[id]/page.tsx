import Link from "next/link";
import { notFound } from "next/navigation";
import { catalog } from "@/lib/catalog";
import { formatDuration } from "@/lib/format";
import { PlayButton } from "@/components/player/play-button";
import { Cover } from "@/components/ui/cover";

export default async function SongPage({ params }: { params: { id: string } }) {
  const song = await catalog.getSong(params.id);
  if (!song) notFound();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 py-6">
      <div className="flex items-center gap-6">
        <Cover
          title={song.title}
          url={song.coverUrl}
          seed={song.id}
          className="h-32 w-32 shrink-0 rounded-2xl text-4xl shadow-2xl"
        />
        <div>
          <h1 className="text-3xl font-bold text-foreground">{song.title}</h1>
          <Link
            href={`/artist/${song.artist.slug}`}
            className="mt-1 block text-muted hover:text-primary"
          >
            {song.artist.name}
          </Link>
          {song.album && (
            <Link
              href={`/album/${song.album.slug}`}
              className="mt-0.5 block text-sm text-muted hover:text-primary"
            >
              {song.album.title}
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <PlayButton tracks={[song]} />
        <span className="text-sm text-muted">{formatDuration(song.duration)}</span>
        {song.genre && (
          <Link
            href={`/genre/${song.genre.slug}`}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-primary hover:text-primary"
          >
            {song.genre.name}
          </Link>
        )}
      </div>

      <p className="text-sm text-muted">
        {song.playCount.toLocaleString()} plays
      </p>
    </main>
  );
}
