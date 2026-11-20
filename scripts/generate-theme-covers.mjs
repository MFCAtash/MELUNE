#!/usr/bin/env node
/**
 * Generate a 1280×640 cover card for every theme in globals.css.
 *
 * Source of truth is the CSS token block itself — not a hand-maintained
 * list — so adding or retuning a theme in `apps/web/src/app/globals.css`
 * automatically updates its cover on the next run. Fonts are reused
 * from the committed Emerald Editorial SVG, keeping every generated
 * card visually identical to the rest of the cover family.
 *
 * Usage: npm run covers:themes
 * Output: docs/assets/themes/<theme-id>.svg + index.html
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = path.join(root, "apps/web/src/app/globals.css");
const heroPath = path.join(root, "docs/assets/melune-social-cover.svg");
const outDir = path.join(root, "docs/assets/themes");

const css = readFileSync(cssPath, "utf8");
const hero = readFileSync(heroPath, "utf8");
const fontStyle = hero.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";

function tokensFor(block) {
  const tokens = {};
  for (const match of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

// Defaults from the dark shell; signature/classic blocks only override a
// subset of tokens, exactly as the browser's cascade does for them.
const darkBlock = css.match(/:root,\s*:root\[data-theme="dark"\]\s*\{([\s\S]*?)\}/)?.[1] ?? "";
const defaults = tokensFor(darkBlock);
const defaultBrandA = defaults["brand-a"] ?? "139 92 246";
const defaultBrandB = defaults["brand-b"] ?? "59 130 246";
const defaultHalo1 = defaults["halo-1"] ?? defaultBrandA;
const defaultHalo2 = defaults["halo-2"] ?? defaultBrandB;

const rgb = (value, fallback) => {
  const raw = value ?? fallback;
  const parts = raw.split(/[\s,]+/).map(Number);
  return parts.length >= 3 && parts.every((n) => Number.isFinite(n)) ? parts : [139, 92, 246];
};
const hex = (value, fallback) => {
  const [r, g, b] = rgb(value, fallback);
  return "#" + [r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");
};
const titleCase = (id) =>
  id.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

/** 48 deterministic bars — same silhouette in every theme so the only
 *  variable is color, making the cards directly comparable. */
const bars = Array.from({ length: 48 }, (_, i) => {
  const h = 6 + Math.abs(Math.sin(i * 0.47) * Math.cos(i * 0.19)) * 26;
  return { x: 742 + i * 9.4, h };
});

function coverFor(id, rawTokens) {
  const bg = hex(rawTokens["color-background"], "10 10 15");
  const surface = hex(rawTokens["color-surface"], "18 18 26");
  const elevated = hex(rawTokens["color-surface-elevated"], "26 26 36");
  const fg = hex(rawTokens["color-foreground"], "255 255 255");
  const muted = hex(rawTokens["color-muted"], "138 138 154");
  const border = hex(rawTokens["color-border-rgb"], "38 38 51");
  const brandA = hex(rawTokens["brand-a"], defaultBrandA);
  const brandB = hex(rawTokens["brand-b"], defaultBrandB);
  const halo1 = hex(rawTokens["halo-1"], defaultHalo1);
  const halo2 = hex(rawTokens["halo-2"], defaultHalo2);

  const waveform = bars
    .map(({ x, h }, i) => {
      const color = i < 16 ? brandA : i < 32 ? halo1 : brandB;
      return `<rect x="${x.toFixed(1)}" y="${(470 - h / 2).toFixed(1)}" width="5" height="${h.toFixed(1)}" rx="2.5" fill="${color}" opacity="${(0.45 + (i % 5) * 0.11).toFixed(2)}"/>`;
    })
    .join("");

  return `<svg width="1280" height="640" viewBox="0 0 1280 640" xmlns="http://www.w3.org/2000/svg">
<defs><style>${fontStyle}</style>
  <linearGradient id="bg" x2="1280" y2="640"><stop stop-color="${bg}"/><stop offset="1" stop-color="${surface}"/></linearGradient>
  <linearGradient id="brand" x2="1"><stop stop-color="${brandA}"/><stop offset="1" stop-color="${brandB}"/></linearGradient>
  <radialGradient id="glow1"><stop stop-color="${halo1}" stop-opacity=".45"/><stop offset="1" stop-color="${halo1}" stop-opacity="0"/></radialGradient>
  <radialGradient id="glow2"><stop stop-color="${halo2}" stop-opacity=".38"/><stop offset="1" stop-color="${halo2}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1280" height="640" fill="url(#bg)"/>
<ellipse cx="1080" cy="120" rx="520" ry="420" fill="url(#glow1)"/>
<ellipse cx="760" cy="620" rx="520" ry="380" fill="url(#glow2)"/>
<text x="76" y="86" font-family="SG" font-size="12" fill="${brandA}" letter-spacing="6">MELUNE / THEME SPECIMEN</text>
<text x="70" y="232" font-family="IS" font-size="104" fill="${fg}" letter-spacing="-2">MELUNE</text>
<text x="76" y="286" font-family="SG" font-size="34" font-weight="600" fill="${fg}">${titleCase(id)}</text>
<line x1="76" y1="318" x2="520" y2="318" stroke="url(#brand)" stroke-width="2"/>
<text x="76" y="356" font-family="SG" font-size="15" fill="${muted}" letter-spacing="2">One palette. The whole player repaints.</text>
<g transform="translate(76 410)">
  <circle cx="11" cy="11" r="11" fill="${bg}" stroke="${border}"/>
  <circle cx="47" cy="11" r="11" fill="${surface}" stroke="${border}"/>
  <circle cx="83" cy="11" r="11" fill="${elevated}" stroke="${border}"/>
  <circle cx="119" cy="11" r="11" fill="${brandA}"/>
  <circle cx="155" cy="11" r="11" fill="${brandB}"/>
  <circle cx="191" cy="11" r="11" fill="${halo1}"/>
  <circle cx="227" cy="11" r="11" fill="${halo2}"/>
</g>
<text x="76" y="576" font-family="SG" font-size="11" fill="${muted}" letter-spacing="3.4">data-theme="${id}" · GITHUB.COM/MFCATASH/MELUNE</text>
<g>
  <rect x="716" y="292" width="500" height="238" rx="28" fill="${elevated}" stroke="${border}"/>
  <rect x="744" y="320" width="84" height="84" rx="16" fill="url(#brand)"/>
  <circle cx="786" cy="362" r="18" fill="${bg}" opacity=".85"/>
  <circle cx="786" cy="362" r="6" fill="${brandB}"/>
  <text x="848" y="348" font-family="SG" font-size="16" font-weight="600" fill="${fg}">Now playing</text>
  <text x="848" y="376" font-family="SG" font-size="12" fill="${muted}">MELUNE — Signature mix</text>
  ${waveform}
  <path d="M748 506 L766 518 L748 530 Z" fill="${fg}"/>
  <circle cx="848" cy="518" r="13" fill="url(#brand)"/>
  <path d="M843 511 L856 518 L843 525 Z" fill="${fg}"/>
</g>
</svg>`;
}

mkdirSync(outDir, { recursive: true });
const themes = [];
for (const match of css.matchAll(/:root\[data-theme="([^"]+)"\]\s*\{([\s\S]*?)\}/g)) {
  const id = match[1];
  if (id === "dark") continue; // the default shell; covered by :root
  const tokens = { ...defaults, ...tokensFor(match[2]) };
  writeFileSync(path.join(outDir, `${id}.svg`), coverFor(id, tokens), "utf8");
  themes.push(id);
}

const cards = themes
  .map((id) => `<figure><img src="./${id}.svg" alt="${titleCase(id)} theme"><figcaption>${titleCase(id)}</figcaption></figure>`)
  .join("\n");
writeFileSync(
  path.join(outDir, "index.html"),
  `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>MELUNE theme covers</title>
<style>body{margin:0;background:#070b09;color:#e9f6f0;font-family:system-ui,sans-serif;padding:24px}
h1{font-size:22px;color:#9ee7c6}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:16px}
figure{margin:0;border:1px solid #1b2a23;border-radius:12px;overflow:hidden;background:#0b120f}
img{width:100%;display:block}figcaption{padding:8px 12px;font-size:13px;color:#c8f6e2}</style></head>
<body><h1>${themes.length} MELUNE theme covers — generated from globals.css</h1>
<div class="grid">${cards}</div></body></html>`,
  "utf8",
);

console.log(`Generated ${themes.length} theme covers in docs/assets/themes/`);
