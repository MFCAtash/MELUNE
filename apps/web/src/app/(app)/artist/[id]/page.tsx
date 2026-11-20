import Link from "next/link";
import { notFound } from "next/navigation";
import { catalog } from "@/lib/catalog";
import { PlayButton } from "@/components/player/play-button";
import { TrackList } from "@/components/player/track-list";
import { AmbientPageBackdrop } from "@/components/player/ambient-page-backdrop";
import { Cover } from "@/components/ui/cover";
import { SaveToLibraryButton } from "@/components/library/save-to-library-button";

export default async function ArtistPage({ params }: { params: { id: string } }) {
  const artist = await catalog.getArtist(params.id);
  if (!artist) notFound();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 py-6">
      <div className="relative isolate flex items-center gap-6 overflow-hidden rounded-3xl p-6">
        <AmbientPageBackdrop coverUrl={artist.imageUrl} seed={artist.id} />
        <Cover
          title={artist.name}
          url={artist.imageUrl}
          seed={artist.id}
          className="h-40 w-40 shrink-0 rounded-full text-5xl shadow-2xl"
        />
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Artist</p>
          <h1 className="mt-1 text-4xl font-bold text-foreground">{artist.name}</h1>
          {artist.bio && <p className="mt-3 max-w-xl text-sm text-muted">{artist.bio}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {artist.songs.length > 0 && <PlayButton tracks={artist.songs} label="Play popular" />}
        <SaveToLibraryButton type="artist" id={artist.id} />
      </div>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">Popular songs</h2>
        <TrackList tracks={artist.songs} />
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-foreground">Albums</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {artist.albums.map((album) => (
            <Link
              key={album.id}
              href={`/album/${album.slug}`}
              className="rounded-xl border border-border p-3 transition hover:border-primary"
            >
              <div className="mb-3 aspect-square overflow-hidden rounded-lg">
                <Cover
                  title={album.title}
                  url={album.coverUrl}
                  seed={album.id}
                  className="h-full w-full rounded-lg text-2xl"
                />
              </div>
              <p className="truncate text-sm font-medium text-foreground">{album.title}</p>
            </Link>
          ))}
          {artist.albums.length === 0 && (
            <p className="col-span-full text-sm text-muted">No albums yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
