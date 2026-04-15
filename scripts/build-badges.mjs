#!/usr/bin/env node
/**
 * Generate custom badge icons for Passport.
 *
 * Output: apps/me/public/badges/*.png  (512×512, PNG, transparent bg)
 *
 * Each badge is rendered from an SVG using brand tokens. Designs aim for
 * recognizability at small sizes (badges show as ~32-64px in the UI).
 */

import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'apps', 'me', 'public', 'badges');
const SIZE = 512;

const C = {
  bg: '#0a0a0a',
  card: '#1f2937',
  orange: '#FF8200',
  vibrantOrange: '#FE5000',
  yellow: '#FBDB65',
  purple: '#7D55C7',
  cream: '#FDE68A',
};

// ---------- Passport Pioneer ----------
// A stylized compass rose with the cardinal arrow piercing a chaos burst.
// "First through the door" — exploration + founding.
function passportPioneer() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#1f2937"/>
      <stop offset="100%" stop-color="#0a0a0a"/>
    </radialGradient>
    <linearGradient id="needle" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FF8200"/>
      <stop offset="50%" stop-color="#FE5000"/>
      <stop offset="50%" stop-color="#FBDB65"/>
      <stop offset="100%" stop-color="#FDE68A"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>

  <!-- Coin background -->
  <circle cx="256" cy="256" r="240" fill="url(#bg)" stroke="${C.orange}" stroke-width="6"/>
  <circle cx="256" cy="256" r="220" fill="none" stroke="${C.orange}" stroke-width="2" opacity="0.4"/>

  <!-- Compass dial — minor ticks every 30°, major at cardinals -->
  <g stroke="${C.orange}" stroke-width="3" stroke-linecap="round" opacity="0.6">
    ${cardinalTicks()}
  </g>
  <g stroke="${C.orange}" stroke-width="2" stroke-linecap="round" opacity="0.25">
    ${minorTicks()}
  </g>

  <!-- Cardinal letter N at top -->
  <text x="256" y="92" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
        font-size="32" font-weight="900" fill="${C.yellow}" letter-spacing="2">N</text>

  <!-- Compass needle (north red, south cream) -->
  <g transform="rotate(-12 256 256)">
    <!-- Glow behind -->
    <polygon points="256,80 220,256 256,232 292,256" fill="${C.orange}" opacity="0.35" filter="url(#glow)"/>
    <polygon points="256,432 220,256 256,280 292,256" fill="${C.cream}" opacity="0.2" filter="url(#glow)"/>

    <!-- North half -->
    <polygon points="256,80 220,256 256,232 292,256" fill="url(#needle)" stroke="${C.bg}" stroke-width="2"/>
    <!-- South half -->
    <polygon points="256,432 220,256 256,280 292,256" fill="${C.cream}" stroke="${C.bg}" stroke-width="2"/>
  </g>

  <!-- Center pivot -->
  <circle cx="256" cy="256" r="14" fill="${C.bg}" stroke="${C.orange}" stroke-width="3"/>
  <circle cx="256" cy="256" r="5" fill="${C.orange}"/>
</svg>`;
}

function cardinalTicks() {
  // Long ticks at N/E/S/W
  return [
    'M 256 50 L 256 78',
    'M 256 462 L 256 434',
    'M 50 256 L 78 256',
    'M 462 256 L 434 256',
  ].map((d) => `<path d="${d}"/>`).join('');
}

function minorTicks() {
  // Short ticks at every 15° for a compass dial feel
  let out = '';
  for (let deg = 0; deg < 360; deg += 15) {
    if (deg % 90 === 0) continue;
    const rad = ((deg - 90) * Math.PI) / 180;
    const x1 = 256 + Math.cos(rad) * 218;
    const y1 = 256 + Math.sin(rad) * 218;
    const x2 = 256 + Math.cos(rad) * (deg % 45 === 0 ? 200 : 208);
    const y2 = 256 + Math.sin(rad) * (deg % 45 === 0 ? 200 : 208);
    out += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }
  return out;
}

// ---------- Pollock Party 2026 ----------
// Drip-painting splatter in brand colors over a coin shape.
// Specific to the launch event, deliberately chaotic.
function pollockParty() {
  // Pseudo-random splatter — deterministic for stable output
  const splatters = generateSplatters(42);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#1f2937"/>
      <stop offset="100%" stop-color="#0a0a0a"/>
    </radialGradient>
    <clipPath id="coinClip"><circle cx="256" cy="256" r="234"/></clipPath>
  </defs>

  <circle cx="256" cy="256" r="240" fill="url(#bg)" stroke="${C.yellow}" stroke-width="6"/>

  <!-- Splatter inside coin -->
  <g clip-path="url(#coinClip)">
    ${splatters}
  </g>

  <!-- Year stamp -->
  <g>
    <rect x="180" y="408" width="152" height="48" rx="10" fill="${C.bg}" stroke="${C.yellow}" stroke-width="2"/>
    <text x="256" y="441" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
          font-size="22" font-weight="900" fill="${C.yellow}" letter-spacing="4">2026</text>
  </g>

  <!-- Outer ring tick (limited edition feel) -->
  <circle cx="256" cy="256" r="220" fill="none" stroke="${C.yellow}" stroke-width="2" opacity="0.4" stroke-dasharray="2 8"/>
</svg>`;
}

function generateSplatters(seed) {
  // Mulberry32 deterministic PRNG
  let s = seed;
  const rand = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const palette = [C.orange, C.vibrantOrange, C.yellow, C.purple, C.cream];

  let out = '';
  // Big drips
  for (let i = 0; i < 14; i++) {
    const cx = 80 + rand() * 352;
    const cy = 80 + rand() * 352;
    const r = 18 + rand() * 36;
    const color = palette[Math.floor(rand() * palette.length)];
    out += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${color}" opacity="${(0.7 + rand() * 0.3).toFixed(2)}"/>`;
  }
  // Drip trails
  for (let i = 0; i < 22; i++) {
    const cx = 60 + rand() * 392;
    const cy = 60 + rand() * 392;
    const len = 30 + rand() * 80;
    const w = 4 + rand() * 8;
    const angle = rand() * 360;
    const color = palette[Math.floor(rand() * palette.length)];
    out += `<g transform="rotate(${angle.toFixed(0)} ${cx.toFixed(0)} ${cy.toFixed(0)})">
      <rect x="${(cx - w / 2).toFixed(1)}" y="${cy.toFixed(0)}" width="${w.toFixed(1)}" height="${len.toFixed(0)}" rx="${(w / 2).toFixed(1)}" fill="${color}" opacity="${(0.5 + rand() * 0.4).toFixed(2)}"/>
      <circle cx="${cx.toFixed(1)}" cy="${(cy + len).toFixed(1)}" r="${(w * 0.8).toFixed(1)}" fill="${color}" opacity="${(0.5 + rand() * 0.4).toFixed(2)}"/>
    </g>`;
  }
  // Speckles
  for (let i = 0; i < 60; i++) {
    const cx = 50 + rand() * 412;
    const cy = 50 + rand() * 412;
    const r = 1 + rand() * 4;
    const color = palette[Math.floor(rand() * palette.length)];
    out += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(1)}" fill="${color}" opacity="${(0.5 + rand() * 0.4).toFixed(2)}"/>`;
  }
  return out;
}

// ---------- Fugly's Early Adopter ----------
// A chaotic D6 with the Fugly orange face, glowing pip pattern,
// and slight wobble to feel "in motion."
function fuglysEarlyAdopter() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#1f2937"/>
      <stop offset="100%" stop-color="#0a0a0a"/>
    </radialGradient>
    <linearGradient id="diceTop" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF8200"/>
      <stop offset="100%" stop-color="#FE5000"/>
    </linearGradient>
    <linearGradient id="diceLeft" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#D97706"/>
      <stop offset="100%" stop-color="#A8470A"/>
    </linearGradient>
    <linearGradient id="diceRight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#9A5500"/>
      <stop offset="100%" stop-color="#702C00"/>
    </linearGradient>
    <filter id="glowDie"><feGaussianBlur stdDeviation="8"/></filter>
  </defs>

  <!-- Coin background -->
  <circle cx="256" cy="256" r="240" fill="url(#bg)" stroke="${C.orange}" stroke-width="6"/>

  <!-- Glow behind die -->
  <ellipse cx="256" cy="280" rx="160" ry="40" fill="${C.orange}" opacity="0.3" filter="url(#glowDie)"/>

  <!-- Isometric D6 (slight tilt for chaos) -->
  <g transform="rotate(-8 256 256)">
    <!-- Top face (visible) -->
    <polygon points="256,108 392,184 256,260 120,184" fill="url(#diceTop)" stroke="${C.bg}" stroke-width="3"/>
    <!-- Left face -->
    <polygon points="120,184 256,260 256,420 120,344" fill="url(#diceLeft)" stroke="${C.bg}" stroke-width="3"/>
    <!-- Right face -->
    <polygon points="392,184 256,260 256,420 392,344" fill="url(#diceRight)" stroke="${C.bg}" stroke-width="3"/>

    <!-- Top face pips: showing 5 (center + 4 corners) -->
    ${pip(256, 184, 14)}
    ${pip(218, 156, 11)}
    ${pip(294, 156, 11)}
    ${pip(218, 212, 11)}
    ${pip(294, 212, 11)}

    <!-- Left face pips: showing 3 (diagonal) -->
    ${pip(160, 240, 12, C.cream)}
    ${pip(188, 308, 12, C.cream)}
    ${pip(216, 376, 12, C.cream)}

    <!-- Right face pips: showing 4 (corners) -->
    ${pip(296, 240, 12, C.cream)}
    ${pip(296, 360, 12, C.cream)}
    ${pip(352, 240, 12, C.cream)}
    ${pip(352, 360, 12, C.cream)}
  </g>

  <!-- Yellow spark off the corner (Fugly chaos) -->
  <g transform="translate(380 130)">
    <circle r="14" fill="${C.yellow}"/>
    <circle r="28" fill="${C.yellow}" opacity="0.25"/>
    <circle r="48" fill="${C.yellow}" opacity="0.08"/>
  </g>
</svg>`;
}

function pip(cx, cy, r, color = '#FBDB65') {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="${C.bg}" stroke-width="1.5"/>`;
}

// ---------- Render ----------
async function render(name, svg) {
  const outPath = path.join(OUT_DIR, `${name}.png`);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).resize(SIZE, SIZE).toFile(outPath);
  const { stat } = await import('fs/promises');
  const s = await stat(outPath);
  console.log(`  ${name}.png — ${(s.size / 1024).toFixed(0)} KB`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Rendering badges at ${SIZE}×${SIZE}:`);
  await render('passport-pioneer', passportPioneer());
  await render('pollock-party-2026', pollockParty());
  await render('fugly-early-adopter', fuglysEarlyAdopter());
  console.log(`\nWrote to ${OUT_DIR}`);
  console.log('Reachable at https://afterroar.me/badges/<slug>.png after deploy.');
}

main().catch((err) => { console.error(err); process.exit(1); });
