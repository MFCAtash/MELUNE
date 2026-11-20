// Build a 1280x640 social-preview image for MELUNE from the real hero covers.
// Uses `sharp` (already in the workspace). No external image service needed.
import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const coversDir = path.join(root, "apps/web/public/hero-covers");
const out = path.join(root, "docs/assets/melune-preview.png");

const files = [
  "tarafdar.jpg",
  "googoosh.jpg",
  "bi-ehsas.jpg",
  "hayedeh.jpg",
  "ebi.jpg",
];

const size = 230;
const covers = [];
for (const f of files) {
  const buf = await readFile(path.join(coversDir, f));
  const base64 = (
    await sharp(buf)
      .resize(size, size, { fit: "cover" })
      .png()
      .toBuffer()
  ).toString("base64");
  covers.push(`data:image/png;base64,${base64}`);
}

// Five-cover "cover flow": center is large and upright; outer pairs tilt and
// recede. x positions and rotations create the 3D arc.
const layout = [
  { x: 250, y: 250, w: 150, h: 150, rot: -18, op: 0.55 },
  { x: 410, y: 220, w: 185, h: 185, rot: -9, op: 0.8 },
  { x: 605, y: 195, w: 230, h: 230, rot: 0, op: 1 },
  { x: 845, y: 220, w: 185, h: 185, rot: 9, op: 0.8 },
  { x: 1015, y: 250, w: 150, h: 150, rot: 18, op: 0.55 },
];

const coverEls = layout
  .map((l, i) => {
    const cx = l.x + l.w / 2;
    const cy = l.y + l.h / 2;
    return `<g transform="translate(${cx} ${cy}) rotate(${l.rot}) translate(${-l.w / 2} ${-l.h / 2})" opacity="${l.op}">
      <rect x="-8" y="-8" width="${l.w + 16}" height="${l.h + 16}" rx="18" fill="#B8FF3C" opacity="0.18"/>
      <image href="${covers[i]}" width="${l.w}" height="${l.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#card)"/>
      <rect x="0" y="0" width="${l.w}" height="${l.h}" rx="12" fill="none" stroke="#B8FF3C" stroke-opacity="0.55" stroke-width="2"/>
    </g>`;
  })
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1280" height="640" viewBox="0 0 1280 640">
  <defs>
    <clipPath id="card"><rect x="0" y="0" width="230" height="230" rx="12"/></clipPath>
    <radialGradient id="bg" cx="50%" cy="40%" r="75%">
      <stop offset="0%" stop-color="#16202a"/>
      <stop offset="60%" stop-color="#0d1118"/>
      <stop offset="100%" stop-color="#07080d"/>
    </radialGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#B8FF3C" stop-opacity="0"/>
      <stop offset="100%" stop-color="#B8FF3C" stop-opacity="0.12"/>
    </linearGradient>
  </defs>

  <rect width="1280" height="640" fill="url(#bg)"/>
  <ellipse cx="640" cy="470" rx="430" ry="120" fill="#B8FF3C" opacity="0.07"/>
  <rect x="0" y="540" width="1280" height="100" fill="url(#glow)"/>

  <text x="640" y="92" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="74" font-weight="800" letter-spacing="10" fill="#ffffff">MELUNE</text>
  <text x="640" y="132" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="600" letter-spacing="6" fill="#B8FF3C">YOUR MUSIC. SMARTER.</text>

  ${coverEls}

  <g font-family="Arial, Helvetica, sans-serif" fill="#8b96a5">
    <text x="640" y="520" text-anchor="middle" font-size="20" letter-spacing="1">21 themes  ·  5-cover Cover Flow  ·  Persian-first  ·  HLS + offline</text>
  </g>

  <!-- now-playing bar -->
  <g transform="translate(340 566)">
    <rect width="600" height="54" rx="27" fill="#121821" stroke="#B8FF3C" stroke-opacity="0.35" stroke-width="1.5"/>
    <circle cx="34" cy="27" r="16" fill="#B8FF3C"/>
    <path d="M29 19 L43 27 L29 35 Z" fill="#0a0d12"/>
    <rect x="64" y="18" width="230" height="8" rx="4" fill="#26303c"/>
    <rect x="64" y="18" width="150" height="8" rx="4" fill="#B8FF3C"/>
    <rect x="64" y="36" width="180" height="5" rx="2.5" fill="#1f2833"/>
    <text x="470" y="24" font-size="13" fill="#8b96a5">Persian · RTL</text>
    <text x="470" y="42" font-size="13" fill="#B8FF3C">Now playing</text>
  </g>
</svg>`;

await mkdir(path.dirname(out), { recursive: true });
await sharp(Buffer.from(svg)).png({ quality: 92 }).toFile(out);
console.log(`wrote ${out}`);
