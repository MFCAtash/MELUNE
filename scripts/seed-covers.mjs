/**
 * Generates professional SVG cover art for the Codex Music demo catalog:
 *   - 7 artist avatars        -> apps/web/public/covers/artist-<slug>.svg
 *   - 7 "Best of" album covers-> apps/web/public/covers/album-<slug>.svg
 *   - 21 song covers          -> apps/web/public/covers/song-<slug>.svg
 * Design: rich two-stop gradients per artist, radial glow, vinyl-arc motif,
 * bottom scrim, artist/genre/year typography, big monogram watermark.
 * Persian titles render with system fonts (Tahoma/Segoe UI have Persian glyphs).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "apps", "web", "public", "covers");
mkdirSync(outDir, { recursive: true });

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------------------------------------------------------------- catalog
const ARTISTS = [
  {
    slug: "billie-eilish", name: "Billie Eilish", nameFa: "بیلی آیلیش",
    bio: "خواننده و ترانه‌سرای آمریکایی؛ ستاره پاپ آلترناتیو جهان با سبک تاریک و مینیمال و چند جایزه گرامی.",
    c1: "#0b0f0c", c2: "#123524", accent: "#d7ff3f", init: "B",
    albums: [{ title: "Best of Billie Eilish", date: "2021-03-29" }],
    songs: [
      { title: "Bad Guy", titleFa: "بد گای", year: 2019, genre: "Pop", dur: 194, bpm: 135, mood: "energetic", energy: 0.85, hue: 0 },
      { title: "Ocean Eyes", titleFa: "اوشن آیز", year: 2015, genre: "Pop", dur: 200, bpm: 70, mood: "dreamy", energy: 0.35, hue: 1 },
      { title: "Happier Than Ever", titleFa: "خوشحال‌تر از همیشه", year: 2021, genre: "Pop", dur: 298, bpm: 75, mood: "emotional", energy: 0.6, hue: 2 },
    ],
  },
  {
    slug: "shakira", name: "Shakira", nameFa: "شکیرا",
    bio: "خواننده کلمبیایی؛ ملکه پاپ لاتین با سبک و رقص منحصربه‌فرد، فروش بیش از ۹۰ میلیون آلبوم در جهان.",
    c1: "#7f1d1d", c2: "#f59e0b", accent: "#ffd166", init: "S",
    albums: [{ title: "Best of Shakira", date: "2010-05-20" }],
    songs: [
      { title: "Hips Don't Lie", titleFa: "هیپس دان لای", year: 2006, genre: "Latin Pop", dur: 218, bpm: 100, mood: "dance", energy: 0.9, hue: 0 },
      { title: "Waka Waka", titleFa: "واکا واکا", year: 2010, genre: "Latin Pop", dur: 211, bpm: 128, mood: "energetic", energy: 0.9, hue: 1 },
      { title: "Whenever, Wherever", titleFa: "ون‌اور وِیر اِوِر", year: 2001, genre: "Latin Pop", dur: 217, bpm: 106, mood: "dance", energy: 0.75, hue: 2 },
    ],
  },
  {
    slug: "ebi", name: "Ebi", nameFa: "ابی",
    bio: "ابراهیم حامدی «ابی»؛ صدای ماندگار موسیقی پاپ ایران با دهه‌ها فعالیت و میلیون‌ها طرفدار در سراسر جهان.",
    c1: "#1e3a8a", c2: "#38bdf8", accent: "#fbbf24", init: "E",
    albums: [{ title: "Best of Ebi", date: "1985-06-01" }],
    songs: [
      { title: "Parandeh-ye Mohajer", titleFa: "پرنده مهاجر", year: 1975, genre: "Persian Pop", dur: 240, bpm: 92, mood: "nostalgic", energy: 0.5, hue: 0 },
      { title: "Doostet Daram", titleFa: "دوستت دارم", year: 1982, genre: "Persian Pop", dur: 265, bpm: 88, mood: "romantic", energy: 0.45, hue: 1 },
      { title: "Bavar Kon", titleFa: "باور کن", year: 1985, genre: "Persian Pop", dur: 230, bpm: 96, mood: "emotional", energy: 0.55, hue: 2 },
    ],
  },
  {
    slug: "googoosh", name: "Googoosh", nameFa: "گوگوش",
    bio: "گوگوش؛ مهم‌ترین خواننده زن تاریخ موسیقی ایران و نماد پنجاه سال ترانه فارسی.",
    c1: "#7c2d12", c2: "#f97316", accent: "#0d9488", init: "G",
    albums: [{ title: "Best of Googoosh", date: "1972-08-15" }],
    songs: [
      { title: "Mordab", titleFa: "مرداب", year: 1970, genre: "Persian Pop", dur: 210, bpm: 84, mood: "nostalgic", energy: 0.4, hue: 0 },
      { title: "Ghazal", titleFa: "غزل", year: 1974, genre: "Persian Pop", dur: 200, bpm: 80, mood: "romantic", energy: 0.4, hue: 1 },
      { title: "Dokhtar-e Shah Pariyon", titleFa: "دختر شاه پریون", year: 1972, genre: "Persian Pop", dur: 245, bpm: 90, mood: "playful", energy: 0.55, hue: 2 },
    ],
  },
  {
    slug: "dariush", name: "Dariush", nameFa: "داریوش",
    bio: "داریوش رفیعی؛ صدای اعتراض و امید ایران با بیش از پنج دهه ترانه برای آزادی و انسان.",
    c1: "#450a0a", c2: "#b45309", accent: "#fcd34d", init: "D",
    albums: [{ title: "Best of Dariush", date: "1977-03-01" }],
    songs: [
      { title: "Booye Gandom", titleFa: "بوی گندم", year: 1977, genre: "Persian Pop", dur: 290, bpm: 78, mood: "hopeful", energy: 0.5, hue: 0 },
      { title: "Marde Tanha", titleFa: "مرد تنها", year: 1975, genre: "Persian Pop", dur: 260, bpm: 76, mood: "melancholic", energy: 0.4, hue: 1 },
      { title: "Yaraneh", titleFa: "یارانه", year: 1988, genre: "Persian Pop", dur: 250, bpm: 82, mood: "emotional", energy: 0.5, hue: 2 },
    ],
  },
  {
    slug: "hayedeh", name: "Hayedeh", nameFa: "هایده",
    bio: "هایده؛ صدای آشنای آسمان شب ایران، استاد ردیف و آواز اصیل با ترانه‌های جاودانه عاشقانه.",
    c1: "#312e81", c2: "#7c3aed", accent: "#eab308", init: "H",
    albums: [{ title: "Best of Hayedeh", date: "1975-11-01" }],
    songs: [
      { title: "Sargozasht", titleFa: "سرگذشت", year: 1975, genre: "Persian Traditional", dur: 400, bpm: 64, mood: "sorrowful", energy: 0.35, hue: 0 },
      { title: "Shah Kavir", titleFa: "شاه کاویر", year: 1978, genre: "Persian Traditional", dur: 380, bpm: 60, mood: "mystical", energy: 0.35, hue: 1 },
      { title: "To Kojai", titleFa: "تو کجایی", year: 1972, genre: "Persian Traditional", dur: 420, bpm: 58, mood: "melancholic", energy: 0.3, hue: 2 },
    ],
  },
  {
    slug: "shadmehr-aghili", name: "Shadmehr Aghili", nameFa: "شادمهر عقیلی",
    bio: "شادمهر عقیلی؛ آهنگساز، نوازنده violin و خواننده محبوب نسل جدید موسیقی پاپ ایران.",
    c1: "#0e7490", c2: "#4f46e5", accent: "#22d3ee", init: "S",
    albums: [{ title: "Best of Shadmehr", date: "2005-01-01" }],
    songs: [
      { title: "Dele Man", titleFa: "دل من", year: 1999, genre: "Persian Pop", dur: 225, bpm: 100, mood: "romantic", energy: 0.6, hue: 0 },
      { title: "Adama", titleFa: "آدما", year: 2005, genre: "Persian Pop", dur: 240, bpm: 104, mood: "emotional", energy: 0.65, hue: 1 },
      { title: "Mast", titleFa: "مست", year: 2016, genre: "Persian Pop", dur: 250, bpm: 108, mood: "passionate", energy: 0.7, hue: 2 },
    ],
  },
];

// hue shift for per-song variety
function shift(hex, deg) {
  const n = parseInt(hex.slice(1), 16);
  let [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const toHsl = () => { r/=255; g/=255; b/=255; const mx=Math.max(r,g,b),mn=Math.min(r,g,b); let h=0,s=0,l=(mx+mn)/2; const d=mx-mn; if(d){ s=l>0.5?d/(2-mx-mn):d/(mx+mn); h = mx===r ? (g-b)/d+(g<b?6:0) : mx===g ? (b-r)/d+2 : (r-g)/d+4; h*=60; } return [h,s,l]; };
  const toRgb = (h,s,l) => { const f=(n)=>{const k=(n+h/30)%12; const a=s*Math.min(l,1-l); return l - a*Math.max(-1,Math.min(k-3,Math.min(9-k,1)));}; const c=(x)=>Math.round(255*x).toString(16).padStart(2,"0"); return `#${c(f(0))}${c(f(8))}${c(f(4))}`; };
  let [h,s,l] = toHsl();
  h = (h + deg + 360) % 360;
  return toRgb(h, s, l);
}

const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function wrap(title, max = 14) {
  const words = title.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

function songSvg(a, s) {
  const c1 = shift(a.c1, s.hue * 14), c2 = shift(a.c2, -s.hue * 10);
  const lines = wrap(s.title, 13);
  const titleY = 330;
  const titleEls = lines.map((l, i) =>
    `<text x="64" y="${titleY + i * 64}" font-family="'Segoe UI', Tahoma, Arial, sans-serif" font-size="${lines.length > 1 ? 54 : 60}" font-weight="800" fill="#ffffff">${esc(l)}</text>`
  ).join("\n      ");
  const chipW = 30 + s.genre.length * 11;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="82%" cy="14%" r="55%">
      <stop offset="0%" stop-color="${a.accent}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${a.accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="scrim" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.62"/>
      <stop offset="55%" stop-color="#000000" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="640" height="640" fill="url(#bg)"/>
  <rect width="640" height="640" fill="url(#glow)"/>
  <!-- vinyl arcs -->
  <g stroke="#ffffff" stroke-opacity="0.10" fill="none" stroke-width="2">
    <circle cx="-40" cy="620" r="150"/>
    <circle cx="-40" cy="620" r="190"/>
    <circle cx="-40" cy="620" r="230"/>
    <circle cx="-40" cy="620" r="270"/>
  </g>
  <g stroke="${a.accent}" stroke-opacity="0.35" fill="none" stroke-width="3">
    <circle cx="560" cy="120" r="70"/>
    <circle cx="560" cy="120" r="94"/>
  </g>
  <!-- monogram -->
  <text x="596" y="610" text-anchor="end" font-family="'Segoe UI', Tahoma, Arial, sans-serif" font-size="300" font-weight="800" fill="#ffffff" fill-opacity="0.07">${esc(a.init)}</text>
  <!-- scrim -->
  <rect width="640" height="640" fill="url(#scrim)"/>
  <!-- artist name -->
  <text x="64" y="92" font-family="'Segoe UI', Tahoma, Arial, sans-serif" font-size="26" font-weight="700" letter-spacing="7" fill="${a.accent}">${esc(a.name.toUpperCase())}</text>
  <rect x="64" y="106" width="64" height="4" rx="2" fill="${a.accent}"/>
  <!-- title -->
  <g>
      ${titleEls}
  </g>
  <text x="64" y="${titleY + lines.length * 64 + 34}" font-family="Tahoma, 'Segoe UI', sans-serif" font-size="26" fill="#ffffff" fill-opacity="0.82" direction="rtl">${esc(s.titleFa)}</text>
  <!-- genre / year chip -->
  <g font-family="'Segoe UI', Tahoma, Arial, sans-serif" font-size="20" fill="#ffffff">
    <rect x="64" y="556" rx="16" ry="16" width="${chipW}" height="32" fill="#ffffff" fill-opacity="0.14"/>
    <text x="79" y="577" fill-opacity="0.95">${esc(s.genre)}</text>
    <text x="${64 + 15 + chipW + 12}" y="577" fill-opacity="0.7">${s.year}</text>
  </g>
</svg>\n`;
}

function artistSvg(a) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${a.c1}"/>
      <stop offset="100%" stop-color="${a.c2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="60%">
      <stop offset="0%" stop-color="${a.accent}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${a.accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="scrim" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.66"/>
      <stop offset="45%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="640" height="640" fill="url(#bg)"/>
  <rect width="640" height="640" fill="url(#glow)"/>
  <g stroke="#ffffff" stroke-opacity="0.10" fill="none" stroke-width="2">
    <circle cx="320" cy="270" r="180"/>
    <circle cx="320" cy="270" r="216"/>
    <circle cx="320" cy="270" r="252"/>
  </g>
  <text x="320" y="352" text-anchor="middle" font-family="'Segoe UI', Tahoma, Arial, sans-serif" font-size="240" font-weight="800" fill="#ffffff" fill-opacity="0.92">${esc(a.init)}</text>
  <rect width="640" height="640" fill="url(#scrim)"/>
  <text x="320" y="520" text-anchor="middle" font-family="'Segoe UI', Tahoma, Arial, sans-serif" font-size="40" font-weight="700" letter-spacing="3" fill="#ffffff">${esc(a.name)}</text>
  <text x="320" y="566" text-anchor="middle" font-family="Tahoma, 'Segoe UI', sans-serif" font-size="26" fill="#ffffff" fill-opacity="0.75" direction="rtl">${esc(a.nameFa)}</text>
</svg>\n`;
}

function albumSvg(a, al) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
  <defs>
    <linearGradient id="bg" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${a.c1}"/>
      <stop offset="100%" stop-color="${shift(a.c2, 18)}"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.6"/>
      <stop offset="50%" stop-color="#000000" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="640" height="640" fill="url(#bg)"/>
  <g fill="none" stroke="${a.accent}" stroke-opacity="0.4" stroke-width="3">
    <circle cx="320" cy="270" r="120"/>
    <circle cx="320" cy="270" r="152" stroke-opacity="0.2"/>
  </g>
  <circle cx="320" cy="270" r="42" fill="${a.accent}" fill-opacity="0.85"/>
  <circle cx="320" cy="270" r="10" fill="#000000" fill-opacity="0.55"/>
  <text x="64" y="92" font-family="'Segoe UI', Tahoma, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="8" fill="${a.accent}">BEST OF</text>
  <rect width="640" height="640" fill="url(#scrim)"/>
  <text x="64" y="540" font-family="'Segoe UI', Tahoma, Arial, sans-serif" font-size="52" font-weight="800" fill="#ffffff">${esc(a.name)}</text>
  <text x="64" y="582" font-family="Tahoma, 'Segoe UI', sans-serif" font-size="26" fill="#ffffff" fill-opacity="0.75" direction="rtl">${esc(al.title.replace("Best of ", ""))} — ${a.nameFa}</text>
</svg>\n`;
}

let n = 0;
for (const a of ARTISTS) {
  writeFileSync(join(outDir, `artist-${a.slug}.svg`), artistSvg(a)); n++;
  for (const al of a.albums) {
    writeFileSync(join(outDir, `album-${a.slug}.svg`), albumSvg(a, al)); n++;
  }
  for (const s of a.songs) {
    writeFileSync(join(outDir, `song-${slugify(s.title)}.svg`), songSvg(a, s)); n++;
  }
}
console.log(`Generated ${n} cover SVGs -> ${outDir}`);

// Also emit the catalog data as JSON for the seeding step
const catalog = ARTISTS.map((a) => ({
  slug: a.slug, name: a.name, nameFa: a.nameFa, bio: a.bio,
  imageUrl: `http://localhost:3000/covers/artist-${a.slug}.svg`,
  album: {
    title: a.albums[0].title, coverUrl: `http://localhost:3000/covers/album-${a.slug}.svg`,
    releaseDate: a.albums[0].date,
  },
  songs: a.songs.map((s, i) => ({
    ...s,
    slug: slugify(s.title),
    coverUrl: `http://localhost:3000/covers/song-${slugify(s.title)}.svg`,
    audioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(i % 16) + 1}.mp3`,
  })),
}));
writeFileSync(join(root, "scripts", "catalog-data.json"), JSON.stringify(catalog, null, 2));
console.log("catalog-data.json written");
