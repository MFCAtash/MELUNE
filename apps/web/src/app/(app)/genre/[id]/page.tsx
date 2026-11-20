import { notFound } from "next/navigation";
import { catalog } from "@/lib/catalog";
import { coverGradient } from "@/lib/cover";
import { PlayButton } from "@/components/player/play-button";
import { TrackList } from "@/components/player/track-list";

export default async function GenrePage({ params }: { params: { id: string } }) {
  const genre = await catalog.getGenre(params.id);
  if (!genre) notFound();

  const songs = await catalog.listSongsByGenre(genre.id);
  const tracks = songs?.items ?? [];
  // Each genre gets a stable color from the extended palette instead of
  // the one brand gradient every page used to share — Rock and Jazz no
  // longer look identical at the top of the page.
  const gradient = coverGradient(genre.id);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 py-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Genre</p>
        <h1
          style={{ backgroundImage: gradient }}
          className="font-display mt-1 bg-clip-text text-4xl font-bold text-transparent"
        >
          {genre.name}
        </h1>
      </div>

      {tracks.length > 0 && <PlayButton tracks={tracks} />}

      <TrackList tracks={tracks} showArtist />
    </main>
  );
}
