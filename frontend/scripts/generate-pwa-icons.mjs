// Generates the PWA app icons from the Stampd coin logo (the same geometry
// inlined as the favicon in index.html). Run manually when the logo changes:
//   node scripts/generate-pwa-icons.mjs
//
// Not part of the build — the PNGs are committed to public/. sharp is a
// build-time-only devDependency; nothing here ships to the browser.
//
// "any" icons carry a small cream margin so they read as an intentional tile.
// The maskable icon pulls the coins well inside the center (~53% of the
// canvas) so an OS circle/squircle mask (which can crop ~10% per edge) never
// clips the mark, and the cream fills the whole square so masking never
// reveals transparency.

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const CREAM = "#F3ECE2";

const svg = (size, contentScale) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${CREAM}"/>
  <g transform="translate(50 50) scale(${contentScale}) translate(-49 -50)">
    <circle cx="36" cy="38" r="24" fill="none" stroke="#1F1B18" stroke-width="6"/>
    <circle cx="62" cy="62" r="24" fill="#C15D2C" stroke="#1F1B18" stroke-width="6"/>
    <path transform="translate(62 62)" fill="#F3ECE2" d="M0,-12 Q1.7,-1.7 12,0 Q1.7,1.7 0,12 Q-1.7,1.7 -12,0 Q-1.7,-1.7 0,-12 Z"/>
  </g>
</svg>`;

const targets = [
  { file: "pwa-192x192.png", size: 192, scale: 0.9 },
  { file: "pwa-512x512.png", size: 512, scale: 0.9 },
  { file: "pwa-maskable-512x512.png", size: 512, scale: 0.66 },
  { file: "apple-touch-icon.png", size: 180, scale: 0.82 },
];

for (const { file, size, scale } of targets) {
  const out = join(publicDir, file);
  await sharp(Buffer.from(svg(size, scale))).resize(size, size).png().toFile(out);
  console.log(`wrote ${file} (${size}x${size})`);
}
