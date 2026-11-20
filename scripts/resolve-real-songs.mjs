/**
 * Replaces the demo catalog with REAL official data via the public iTunes
 * Search API (Apple's official, public song metadata + 30s preview clips):
 *   - real official audio preview  -> apps/web/public/audio-real/<slug>.m4a
 *   - real official artwork (600px)-> apps/web/public/covers-real/<slug>.jpg
 *   - real album name / year / duration / genre
 * Then emits localize-real.sql to update songs/albums/artists to the
 * locally-hosted files (same-origin, so Web Audio stays untangled).
 *
 * Note: full-length copyrighted recordings cannot legally be bundled;
 * these are Apple's official 30-second previews played from our own origin.
 */
import { mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const audioDir = join(root, "apps", "web", "public", "audio-real");
const artDir = join(root, "apps", "web", "public", "covers-real");
mkdirSync(audioDir, { recursive: true });
mkdirSync(artDir, { recursive: true });

const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// slug → exact Apple artistName we must match (Hayedeh is listed as "هایده")
const ARTIST_MATCH = {
  "billie-eilish": (n) => n === "Billie Eilish",
  shakira: (n) => n.startsWith("Shakira"),
  ebi: (n) => n === "Ebi" || n === "ابی",
  googoosh: (n) => n === "Googoosh" || n === "گوگوش",
  dariush: (n) => n === "Dariush" || n === "داریوش",
  hayedeh: (n) => n === "هایده" || n === "Hayedeh",
  "shadmehr-aghili": (n) => n === "Shadmehr Aghili" || n === "شادمهر",
};

const SONGS = [
  // artist slug, display title (current DB), search term, real track title match
  { a: "billie-eilish", t: "Bad Guy", q: "bad guy billie eilish", m: "bad guy" },
  { a: "billie-eilish", t: "Ocean Eyes", q: "ocean eyes billie eilish", m: "ocean eyes" },
  { a: "billie-eilish", t: "Happier Than Ever", q: "happier than ever billie eilish", m: "happier than ever" },
  { a: "shakira", t: "Hips Don't Lie", q: "hips don't lie shakira", m: "hips don't lie" },
  { a: "shakira", t: "Waka Waka", q: "waka waka shakira", m: "waka waka" },
  { a: "shakira", t: "Whenever, Wherever", q: "whenever wherever shakira", m: "whenever, wherever" },
  { a: "ebi", t: "Goriz", q: "goriz ebi", m: "goriz" },
  { a: "ebi", t: "Gheseh Eshgh", q: "gheseh eshgh ebi", m: "gheseh eshgh" },
  { a: "ebi", t: "Khanom Gol", q: "khanom gol ebi", m: "khanom gol" },
  { a: "googoosh", t: "Hamsafar", q: "hamsafar googoosh", m: "hamsafar" },
  { a: "googoosh", t: "Man Amadeh-Am", q: "man amadeh am googoosh", m: "man amadeh-am" },
  { a: "googoosh", t: "Talagh", q: "talagh googoosh", m: "talagh" },
  { a: "dariush", t: "Shame Mahtab", q: "shame mahtab dariush", m: "shame mahtab" },
  { a: "dariush", t: "Mara Be Khaneam Bebar", q: "mara be khaneam bebar dariush", m: "mara be khaneam bebar" },
  { a: "dariush", t: "Ay Eshgh", q: "ay eshgh dariush faramarz aslani", m: "ay eshgh" },
  { a: "hayedeh", t: "Shanehayat", q: "shanehayat hayedeh", m: "shanehayat" },
  { a: "hayedeh", t: "Zendegi", q: "zendegi hayedeh", m: "zendegi" },
  { a: "hayedeh", t: "Dele Divooneh", q: "dele divooneh hayedeh", m: "dele divooneh" },
  { a: "shadmehr-aghili", t: "To Bi Man", q: "to bi man shadmehr aghili", m: "to bi man" },
  { a: "shadmehr-aghili", t: "Halam Avaz Mishe", q: "halam avaz mishe shadmehr aghili", m: "halam avaz mishe" },
  { a: "shadmehr-aghili", t: "Che Khab Hayee", q: "che khab hayee shadmehr aghili", m: "che khab hayee" },
];

// note: DB song titles currently are the old demo names — we'll rename them
// to the real Apple track names, keyed by (artist slug, search order).
// DB title ↔ real title mapping happens via a dedicated title map below.
const DB_TITLE_BY_KEY = {
  "billie-eilish|Bad Guy": "Bad Guy",
  "billie-eilish|Ocean Eyes": "Ocean Eyes",
  "billie-eilish|Happier Than Ever": "Happier Than Ever",
  "shakira|Hips Don't Lie": "Hips Don't Lie",
  "shakira|Waka Waka": "Waka Waka",
  "shakira|Whenever, Wherever": "Whenever, Wherever",
  "ebi|Goriz": "Parandeh-ye Mohajer",        // existing demo title -> becomes Goriz
  "ebi|Gheseh Eshgh": "Doostet Daram",
  "ebi|Khanom Gol": "Bavar Kon",
  "googoosh|Hamsafar": "Mordab",
  "googoosh|Man Amadeh-Am": "Ghazal",
  "googoosh|Talagh": "Dokhtar-e Shah Pariyon",
  "dariush|Shame Mahtab": "Booye Gandom",
  "dariush|Mara Be Khaneam Bebar": "Marde Tanha",
  "dariush|Ay Eshgh": "Yaraneh",
  "hayedeh|Shanehayat": "Sargozasht",
  "hayedeh|Zendegi": "Shah Kavir",
  "hayedeh|Dele Divooneh": "To Kojai",
  "shadmehr-aghili|To Bi Man": "Dele Man",
  "shadmehr-aghili|Halam Avaz Mishe": "Adama",
  "shadmehr-aghili|Che Khab Hayee": "Mast",
};

async function itunes(q) {
  const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=25`);
  if (!res.ok) throw new Error(`itunes ${res.status}`);
  return (await res.json()).results ?? [];
}

// Downloads via curl (this machine's network is flaky; curl's retry logic
// is proven here). is1-ssl.mzstatic.com is unreachable from this network —
// the other mirror hosts (is2..is5) serve the same images, so rewrite to is4.
function download(url, out) {
  if (url.startsWith("https://is1-ssl.mzstatic.com")) {
    url = url.replace("is1-ssl.mzstatic.com", "is4-ssl.mzstatic.com");
  }
  execFileSync(
    "curl.exe",
    ["-s", "-L", "--retry", "6", "--retry-delay", "3", "--retry-all-errors", "--max-time", "120", "-o", out, url],
    { timeout: 150_000 }
  );
}

const results = [];
const failures = [];

for (const s of SONGS) {
  const key = `${s.a}|${s.t}`;
  const dbTitle = DB_TITLE_BY_KEY[key];
  let found = null;
  for (let attempt = 0; attempt < 3 && !found; attempt++) {
    await sleep(3000); // stay under iTunes' rate limit
    try {
      const list = await itunes(attempt === 0 ? s.q : `${s.m} ${s.a.replace("-", " ")}`);
      found =
        list.find(
          (r) =>
            ARTIST_MATCH[s.a](r.artistName ?? "") &&
            (r.trackName ?? "").toLowerCase().includes(s.m.toLowerCase()) &&
            r.previewUrl
        ) ?? null;
    } catch (e) {
      failures.push(`${s.t}: search failed (${e.message})`);
    }
  }
  if (!found) {
    failures.push(`${s.t}: no matching track with preview on iTunes`);
    continue;
  }

  const slug = slugify(s.t);
  const art600 = (found.artworkUrl100 ?? "").replace("/100x100bb", "/600x600bb");
  const outAudio = join(audioDir, `${slug}.m4a`);
  const outArt = join(artDir, `${slug}.jpg`);

  if (!existsSync(outAudio) || statSync(outAudio).size < 50_000) {
    try {
      download(found.previewUrl, outAudio);
    } catch (e) {
      failures.push(`${s.t}: preview download failed (${String(e).slice(0, 80)})`);
      continue;
    }
  }
  if (!existsSync(outArt) || statSync(outArt).size < 5_000) {
    try {
      download(art600, outArt);
    } catch (e) {
      failures.push(`${s.t}: artwork download failed (${String(e).slice(0, 80)})`);
      continue;
    }
  }

  results.push({
    key,
    dbTitle,
    realTitle: found.trackName,
    artist: found.artistName,
    album: found.collectionName,
    year: (found.releaseDate ?? "").slice(0, 4),
    releaseDate: found.releaseDate,
    durationSec: Math.round((found.trackTimeMillis ?? 0) / 1000),
    genre: found.primaryGenreName,
    audioUrl: `http://localhost:3000/audio-real/${slug}.m4a`,
    coverUrl: `http://localhost:3000/covers-real/${slug}.jpg`,
  });
  console.log(`OK: ${dbTitle} -> "${found.trackName}" (${found.artistName}, ${found.collectionName}, ${(found.releaseDate ?? "").slice(0, 4)})`);
}

// Build SQL: update songs, plus per-artist album cover + artist image from
// the first (most iconic) track's artwork of that artist.
const q = (v) => v.replace(/'/g, "''");
const lines = ["BEGIN;"];
for (const r of results) {
  lines.push(
    `UPDATE songs SET "audioUrl"='${q(r.audioUrl)}', "coverUrl"='${q(r.coverUrl)}', "duration"=${r.durationSec}, title='${q(r.realTitle)}' WHERE title='${q(r.dbTitle)}';`
  );
}
// album covers / artist images from the first track of each artist
const seen = new Set();
for (const r of results) {
  const artistSlug = r.key.split("|")[0];
  if (seen.has(artistSlug)) continue;
  seen.add(artistSlug);
  const albumTitle = { ebi: "48 Golden Hits of Ebi", googoosh: "40 Golden Hits of Googoosh", dariush: "Donyaye In Roozaye Man", hayedeh: "40 Golden Hits of Hayedeh", "shadmehr-aghili": "Tasvir" }[artistSlug];
  lines.push(
    `UPDATE albums SET "coverUrl"='${q(r.coverUrl)}' WHERE slug='best-of-${artistSlug}';`,
    `UPDATE artists SET "imageUrl"='${q(r.coverUrl)}' WHERE slug='${artistSlug}';`
  );
  if (albumTitle) {
    lines.push(
      `UPDATE albums SET title='${q(albumTitle)}', "coverUrl"='${q(r.coverUrl)}' WHERE slug='best-of-${artistSlug}';`
    );
  }
}
lines.push("COMMIT;");
writeFileSync(join(root, "scripts", "localize-real.sql"), lines.join("\n"));
writeFileSync(join(root, "scripts", "real-catalog.json"), JSON.stringify(results, null, 2));

console.log(`\nresolved ${results.length}/${SONGS.length} songs`);
if (failures.length) {
  console.error("FAILURES:");
  failures.forEach((f) => console.error(" -", f));
}
