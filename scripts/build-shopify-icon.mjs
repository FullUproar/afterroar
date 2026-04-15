#!/usr/bin/env node
/**
 * Build a 1200×1200 PNG app icon for the Shopify App Store.
 *
 * Usage:
 *   node scripts/build-shopify-icon.mjs
 *
 * Output:
 *   scripts/out/afterroar-connect-icon-1200.png
 *
 * Brand tokens from full-uproar-site/CLAUDE.md:
 *   #FF8200  chaosOrange (Pantone 151 C)
 *   #FBDB65  creamYellow (Pantone 120 C)
 *   #7D55C7  chaosPurple (Pantone 266 C)
 *   #1f2937  bgCard
 *   #0a0a0a  bgDark
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'out');
const OUT_PATH = path.join(OUT_DIR, 'afterroar-connect-icon-1200.png');

const SIZE = 1200;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 1200 1200">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#1f2937"/>
      <stop offset="100%" stop-color="#0a0a0a"/>
    </radialGradient>
    <linearGradient id="a" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF8200"/>
      <stop offset="100%" stop-color="#FE5000"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="10"/>
    </filter>
  </defs>

  <!-- Rounded square background -->
  <rect width="1200" height="1200" rx="220" fill="url(#bg)"/>

  <!-- Outer ring -->
  <rect x="60" y="60" width="1080" height="1080" rx="180"
        fill="none" stroke="#FF8200" stroke-width="8" opacity="0.35"/>

  <!-- Compass dial ring (subtle) -->
  <circle cx="600" cy="600" r="440" fill="none" stroke="#FF8200" stroke-width="4" opacity="0.15"/>
  <circle cx="600" cy="600" r="380" fill="none" stroke="#FF8200" stroke-width="2" opacity="0.1"/>

  <!-- Tick marks (N/E/S/W) -->
  <g stroke="#FF8200" stroke-width="8" stroke-linecap="round" opacity="0.6">
    <line x1="600" y1="140" x2="600" y2="200"/>
    <line x1="600" y1="1000" x2="600" y2="1060"/>
    <line x1="140" y1="600" x2="200" y2="600"/>
    <line x1="1000" y1="600" x2="1060" y2="600"/>
  </g>

  <!-- Big "A" stroke with chaos tear -->
  <g transform="rotate(-6 600 600)">
    <path d="M 360 900 L 600 280 L 840 900 M 450 700 L 750 700"
          fill="none"
          stroke="url(#a)"
          stroke-width="96"
          stroke-linecap="round"
          stroke-linejoin="round"/>
    <!-- Glow layer behind the stroke -->
    <path d="M 360 900 L 600 280 L 840 900 M 450 700 L 750 700"
          fill="none"
          stroke="#FF8200"
          stroke-width="140"
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.25"
          filter="url(#glow)"/>
  </g>

  <!-- Cream yellow spark -->
  <circle cx="850" cy="280" r="30" fill="#FBDB65"/>
  <circle cx="850" cy="280" r="60" fill="#FBDB65" opacity="0.2"/>
</svg>`;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .resize(SIZE, SIZE)
    .toFile(OUT_PATH);

  const stat = await import('fs/promises').then((m) => m.stat(OUT_PATH));
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`Size: ${SIZE}×${SIZE}, ${(stat.size / 1024).toFixed(1)} KB`);

  // Also save the SVG source for future tweaks
  await writeFile(path.join(OUT_DIR, 'afterroar-connect-icon.svg'), svg, 'utf8');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
