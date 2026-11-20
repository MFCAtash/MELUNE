import type { Song } from "@melune/types";

/**
 * Local audio import — the "play my own full-length files" path.
 *
 * Files chosen by the user are read straight from disk as object URLs:
 * nothing is uploaded anywhere, the <audio> element plays the blob URL
 * and the files stay on the user's device. Blob URLs live only for the
 * current page session, so imported tracks intentionally aren't
 * persisted — re-importing after a reload is expected.
 */

const AUDIO_EXT = /\.(mp3|m4a|mp4-audio|aac|wav|flac|ogg|oga|opus|weba|webm|wma|aiff?|alac)$/i;

/** "07 - Artist - Title.mp3" → { artist: "Artist", title: "Title" } */
function parseName(name: string): { artist: string | null; title: string } {
  let base = name.replace(AUDIO_EXT, "").replace(/_/g, " ").trim();
  base = base.replace(/^\d{1,3}[\s.\-]+/, "").trim(); // strip leading track numbers
  const parts = base.split(/\s+-\s+/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim() || null, title: parts.slice(1).join(" - ").trim() };
  }
  return { artist: null, title: base || name };
}

/** Read the real duration from the file's metadata via a throwaway element. */
function probeDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: number) => {
      if (settled) return;
      settled = true;
      a.removeAttribute("src");
      a.load();
      resolve(value);
    };
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.addEventListener(
      "loadedmetadata",
      () => finish(Number.isFinite(a.duration) && a.duration > 0 ? Math.round(a.duration) : 0),
      { once: true },
    );
    a.addEventListener("error", () => finish(0), { once: true });
    // Metadata probing is best-effort; a stuck file must not block the queue.
    setTimeout(() => finish(Number.isFinite(a.duration) && a.duration > 0 ? Math.round(a.duration) : 0), 8000);
    a.src = url;
  });
}

export function isAudioFile(file: File): boolean {
  return file.type.startsWith("audio/") || AUDIO_EXT.test(file.name);
}

/**
 * Build player-ready Songs from files picked on this device. Durations are
 * probed so rows and the progress bar show the true length immediately.
 */
export async function filesToTracks(files: File[]): Promise<Song[]> {
  const picked = files.filter(isAudioFile);
  const tracks = await Promise.all(
    picked.map(async (file): Promise<Song> => {
      const url = URL.createObjectURL(file);
      const { artist, title } = parseName(file.name);
      const duration = await probeDuration(url);
      return {
        id: `local-${crypto.randomUUID()}`,
        slug: `local-${crypto.randomUUID()}`,
        title,
        duration,
        audioUrl: url,
        coverUrl: null,
        hlsPlaylistUrl: null,
        playCount: 0,
        artist: { id: "local", name: artist ?? "My device", slug: "local", imageUrl: null },
        album: { id: "local", title: "My device", slug: "my-device", coverUrl: null },
        genre: null,
      };
    }),
  );
  return tracks;
}
