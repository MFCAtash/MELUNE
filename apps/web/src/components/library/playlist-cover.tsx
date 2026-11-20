import type { Song } from "@melune/types";
import { Cover } from "@/components/ui/cover";

/** 2×2 mosaic of the first four songs' artwork, or a single tile when the
 *  playlist has an uploaded cover or too few songs. */
export function PlaylistCover({
  title,
  seed,
  coverUrl,
  songs,
  className = "h-44 w-44 sm:h-56 sm:w-56",
}: {
  title: string;
  seed: string;
  coverUrl?: string | null;
  songs: Song[];
  className?: string;
}) {
  const shell = `${className} shrink-0 overflow-hidden rounded-2xl shadow-2xl`;

  if (coverUrl || songs.length < 4) {
    return (
      <div className={shell}>
        <Cover
          title={title}
          url={coverUrl ?? songs[0]?.coverUrl}
          seed={seed}
          className="h-full w-full text-6xl"
        />
      </div>
    );
  }

  return (
    <div className={`${shell} grid grid-cols-2`}>
      {songs.slice(0, 4).map((song) => (
        <Cover key={song.id} title={song.title} url={song.coverUrl} className="h-full w-full text-2xl" />
      ))}
    </div>
  );
}
