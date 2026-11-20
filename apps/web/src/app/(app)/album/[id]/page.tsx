import Link from "next/link";
import { notFound } from "next/navigation";
import { catalog } from "@/lib/catalog";
import { formatDuration } from "@/lib/format";
import { PlayButton } from "@/components/player/play-button";
import { TrackList } from "@/components/player/track-list";
import { AmbientPageBackdrop } from "@/components/player/ambient-page-backdrop";
import { Cover } from "@/components/ui/cover";
import { SaveToLibraryButton } from "@/components/library/save-to-library-button";

export default async function AlbumPage({ params }: { params: { id: string } }) {
  const album = await catalog.getAlbum(params.id);
  if (!album) notFound();

  const totalSeconds = album.songs.reduce((sum, s) => sum + s.duration, 0);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 py-6">
      <div className="relative isolate flex items-end gap-6 overflow-hidden rounded-3xl p-6">
        <AmbientPageBackdrop coverUrl={album.coverUrl} seed={album.id} />
        <Cover
          title={album.title}
          url={album.coverUrl}
          seed={album.id}
          className="h-40 w-40 shrink-0 rounded-2xl text-5xl shadow-2xl"
        />
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Album</p>
          <h1 className="mt-1 text-4xl font-bold text-foreground">{album.title}</h1>
          <Link
            href={`/artist/${album.artist.slug}`}
            className="mt-2 block text-muted hover:text-primary"
          >
            {album.artist.name}
          </Link>
          <p className="mt-1 text-sm text-muted">
            {album.songs.length} songs · {formatDuration(totalSeconds)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <PlayButton tracks={album.songs} label="Play album" />
        <SaveToLibraryButton type="album" id={album.id} />
      </div>

      <TrackList tracks={album.songs} />
    </main>
  );
}
