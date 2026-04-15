#!/usr/bin/env node
/**
 * Build the 1600×900 feature media image for the Shopify App Store listing.
 *
 * Usage:
 *   node scripts/build-shopify-feature-media.mjs
 *
 * Output:
 *   scripts/out/afterroar-connect-feature-1600x900.png
 *
 * Shopify guidelines:
 *   - 1600px × 900px, JPG or PNG
 *   - Avoid heavy patterns or textured backgrounds
 *   - Don't use Shopify logo
 *   - Don't use screenshots with heavy text
 *   - Visually highlight the app's benefit
 */

import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'out');
const OUT_PATH = path.join(OUT_DIR, 'afterroar-connect-feature-1600x900.png');

const W = 1600;
const H = 900;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bg" cx="30%" cy="40%" r="80%">
      <stop offset="0%" stop-color="#1f2937"/>
      <stop offset="60%" stop-color="#141823"/>
      <stop offset="100%" stop-color="#0a0a0a"/>
    </radialGradient>
    <linearGradient id="orange" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF8200"/>
      <stop offset="100%" stop-color="#FE5000"/>
    </linearGradient>
    <linearGradient id="card" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1f2937"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- Soft orange wash behind headline -->
  <ellipse cx="450" cy="450" rx="520" ry="360" fill="#FF8200" opacity="0.08" filter="url(#glow)"/>

  <!-- Left column: headline + tagline -->
  <g transform="translate(100, 200)">
    <!-- Eyebrow label -->
    <text x="0" y="0"
          font-family="Helvetica, Arial, sans-serif"
          font-size="24"
          font-weight="700"
          letter-spacing="6"
          fill="#FF8200">AFTERROAR CONNECT</text>

    <!-- Main headline -->
    <text x="0" y="100"
          font-family="Helvetica, Arial, sans-serif"
          font-size="92"
          font-weight="900"
          fill="#FBDB65">Reward real</text>
    <text x="0" y="200"
          font-family="Helvetica, Arial, sans-serif"
          font-size="92"
          font-weight="900"
          fill="#FBDB65">customers.</text>

    <!-- Sub-line -->
    <text x="0" y="290"
          font-family="Helvetica, Arial, sans-serif"
          font-size="34"
          font-weight="500"
          fill="#e2e8f0">Automatically. On every paid order.</text>

    <!-- Bottom tag -->
    <text x="0" y="380"
          font-family="Helvetica, Arial, sans-serif"
          font-size="22"
          font-weight="600"
          fill="#9ca3af">No checkout changes. No app for shoppers.</text>
  </g>

  <!-- Right column: flow visual -->
  <g transform="translate(960, 200)">
    <!-- Order card -->
    <g transform="translate(0, 0)">
      <rect width="240" height="150" rx="20" fill="url(#card)" stroke="#374151" stroke-width="2"/>
      <text x="120" y="42" text-anchor="middle"
            font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="700"
            letter-spacing="2" fill="#9ca3af">PAID ORDER</text>
      <text x="120" y="100" text-anchor="middle"
            font-family="Helvetica, Arial, sans-serif" font-size="52" font-weight="900"
            fill="#e2e8f0">$42.00</text>
      <text x="120" y="130" text-anchor="middle"
            font-family="Helvetica, Arial, sans-serif" font-size="14" font-weight="500"
            fill="#6b7280">on Shopify</text>
    </g>

    <!-- Arrow 1 -->
    <g transform="translate(260, 75)">
      <path d="M 0 0 L 60 0 M 50 -8 L 60 0 L 50 8"
            stroke="#FF8200" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>

    <!-- Passport card -->
    <g transform="translate(330, 0)">
      <rect width="240" height="150" rx="20" fill="url(#card)" stroke="#FF8200" stroke-width="2"/>
      <text x="120" y="42" text-anchor="middle"
            font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="700"
            letter-spacing="2" fill="#FF8200">PASSPORT</text>
      <text x="120" y="102" text-anchor="middle"
            font-family="ui-monospace, Menlo, monospace" font-size="36" font-weight="700"
            fill="#FBDB65" letter-spacing="4">K7H3P2N4</text>
      <text x="120" y="130" text-anchor="middle"
            font-family="Helvetica, Arial, sans-serif" font-size="14" font-weight="500"
            fill="#6b7280">matched by email</text>
    </g>

    <!-- Down arrow -->
    <g transform="translate(450, 170)">
      <path d="M 0 0 L 0 50 M -8 40 L 0 50 L 8 40"
            stroke="#FF8200" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>

    <!-- Points card with glow -->
    <g transform="translate(165, 240)">
      <rect x="-4" y="-4" width="288" height="188" rx="24" fill="#FF8200" opacity="0.15" filter="url(#glow)"/>
      <rect width="280" height="180" rx="22" fill="url(#card)" stroke="#FBDB65" stroke-width="2"/>
      <text x="140" y="48" text-anchor="middle"
            font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="700"
            letter-spacing="2" fill="#FBDB65">POINTS AWARDED</text>
      <text x="140" y="120" text-anchor="middle"
            font-family="Helvetica, Arial, sans-serif" font-size="76" font-weight="900"
            fill="#FBDB65">+42</text>
      <text x="140" y="155" text-anchor="middle"
            font-family="Helvetica, Arial, sans-serif" font-size="14" font-weight="500"
            fill="#9ca3af">at your store</text>
    </g>
  </g>

  <!-- Corner compass tick marks (subtle brand motif) -->
  <g stroke="#FF8200" stroke-width="3" stroke-linecap="round" opacity="0.3">
    <line x1="40" y1="60" x2="40" y2="100"/>
    <line x1="40" y1="60" x2="80" y2="60"/>

    <line x1="${W - 40}" y1="${H - 60}" x2="${W - 40}" y2="${H - 100}"/>
    <line x1="${W - 40}" y1="${H - 60}" x2="${W - 80}" y2="${H - 60}"/>
  </g>
</svg>`;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .resize(W, H)
    .toFile(OUT_PATH);

  const { stat } = await import('fs/promises');
  const s = await stat(OUT_PATH);
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`${W}×${H}, ${(s.size / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
