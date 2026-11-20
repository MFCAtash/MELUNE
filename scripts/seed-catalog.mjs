/**
 * Seeds albums + songs for the 7 featured artists via the admin API.
 * Reads scripts/catalog-data.json (written by seed-covers.mjs).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const API = "http://localhost:4000/api";

const catalog = JSON.parse(readFileSync(join(root, "scripts", "catalog-data.json"), "utf8"));

async function api(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

const login = await api("/auth/login", {
  method: "POST",
  body: { email: "admin@melune.app", password: "melune12345" },
});
const token = login.accessToken;
console.log("admin logged in");

const genres = await api("/genres");
const genreMap = Object.fromEntries(genres.map((g) => [g.name, g.id]));
const genreFor = (g) => {
  if (g.startsWith("Latin")) return genreMap["Pop"];
  if (g.startsWith("Persian")) return genreMap["Persian"];
  return genreMap[g] ?? genreMap["Pop"];
};

const artists = await api("/artists?limit=100");
const artistMap = Object.fromEntries(artists.items.map((a) => [a.name, a.id]));

// Map songs' audio files round-robin over SoundHelix's 16 free demo tracks
let audioIdx = 0;
const errors = [];
let created = 0;

for (const artist of catalog) {
  const artistId = artistMap[artist.name];
  if (!artistId) { errors.push(`artist not found: ${artist.name}`); continue; }

  let albumId;
  try {
    const album = await api("/albums", {
      method: "POST",
      token,
      body: {
        title: artist.album.title,
        artistId,
        coverUrl: artist.album.coverUrl,
        releaseDate: artist.album.releaseDate,
      },
    });
    albumId = album.id;
    console.log(`album OK: ${album.title}`);
  } catch (e) {
    // Maybe already seeded (slug conflict) — try to find it instead
    const found = await api(`/artists/${artistId}/albums?limit=10`).catch(() => null);
    const existing = found?.items?.find?.((al) => al.title === artist.album.title);
    if (existing) {
      albumId = existing.id;
      console.log(`album exists: ${artist.album.title}`);
    } else {
      errors.push(e.message); continue;
    }
  }

  for (const s of artist.songs) {
    audioIdx++;
    try {
      const song = await api("/songs", {
        method: "POST",
        token,
        body: {
          title: s.title,
          artistId,
          albumId,
          genreId: genreFor(s.genre),
          duration: s.dur,
          audioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${((audioIdx - 1) % 16) + 1}.mp3`,
          coverUrl: s.coverUrl,
          bpm: s.bpm,
          mood: s.mood,
          energy: s.energy,
        },
      });
      created++;
      console.log(`  song OK: ${song.title} (${s.titleFa})`);
    } catch (e) {
      if (String(e).includes("409") || String(e).includes("exists") || String(e).includes("slug")) {
        console.log(`  song exists: ${s.title}`);
      } else {
        errors.push(e.message);
      }
    }
  }
}

console.log(`\nCreated ${created} songs.`);
if (errors.length) {
  console.error("ERRORS:");
  errors.forEach((e) => console.error(" -", e.slice(0, 200)));
  process.exit(1);
}
