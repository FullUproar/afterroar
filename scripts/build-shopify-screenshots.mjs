#!/usr/bin/env node
/**
 * Build 1600×900 screenshots for the Shopify App Store listing.
 *
 * These are high-fidelity SVG-based mockups using the exact brand tokens
 * from the live UI (same colors, corner radii, typography). No PII — all
 * names and codes are synthetic. No browser chrome — purely in-app views.
 *
 * Output (in scripts/out/):
 *   01-dashboard.png          The store's Connect dashboard, Shopify live
 *   02-consent-qr.png         Consent QR generator mid-flow
 *   03-customer-lookup.png    Looking up a connected customer
 *   04-points-award.png       Awarding points after a lookup
 *   05-passport-settings.png  Customer view of connected stores + points
 */

import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'out');
const W = 1600;
const H = 900;

// Brand tokens (match lib/design-system)
const C = {
  bg: '#0a0a0a',
  card: '#1f2937',
  cardHover: '#374151',
  border: '#374151',
  orange: '#FF8200',
  vibrantOrange: '#FE5000',
  yellow: '#FBDB65',
  purple: '#7D55C7',
  green: '#10b981',
  red: '#ef4444',
  text: '#e2e8f0',
  muted: '#9ca3af',
  dim: '#6b7280',
};

const FONT = 'Helvetica, Arial, sans-serif';
const MONO = 'ui-monospace, Menlo, monospace';

function shellFrame(innerSvg, title) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>

  <!-- Top chrome bar (mimics afterroar.me nav) -->
  <rect x="0" y="0" width="${W}" height="72" fill="#111827"/>
  <text x="56" y="46" font-family="${FONT}" font-size="20" font-weight="900" fill="${C.yellow}">afterroar.me</text>
  <text x="212" y="46" font-family="${FONT}" font-size="14" font-weight="700" letter-spacing="3" fill="${C.orange}">CONNECT</text>

  <!-- Inner content region -->
  <g transform="translate(0, 72)">
    ${innerSvg}
  </g>

  <!-- Tiny page label bottom-right (helps reviewers identify the screen) -->
  <text x="${W - 56}" y="${H - 32}" text-anchor="end"
        font-family="${FONT}" font-size="13" font-weight="600"
        letter-spacing="2" fill="${C.dim}">${title.toUpperCase()}</text>
</svg>`;
}

// ----- 01. Dashboard with Shopify connected -----
function dashboard() {
  return shellFrame(`
    <g transform="translate(56, 40)">
      <text x="0" y="0" font-family="${FONT}" font-size="12" font-weight="700" letter-spacing="3" fill="${C.orange}">AFTERROAR CONNECT</text>
      <text x="0" y="38" font-family="${FONT}" font-size="34" font-weight="900" fill="${C.yellow}">Reddhill Games</text>
      <text x="0" y="66" font-family="${FONT}" font-size="15" fill="${C.muted}">Madison, WI</text>

      <!-- Status pill -->
      <g transform="translate(1180, 6)">
        <rect width="180" height="34" rx="17" fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.3)"/>
        <circle cx="22" cy="17" r="5" fill="${C.green}"/>
        <text x="38" y="22" font-family="${FONT}" font-size="13" font-weight="700" fill="${C.green}">Approved · Beta</text>
      </g>
    </g>

    <!-- Stat cards row -->
    <g transform="translate(56, 140)">
      ${statCard(0, 0, 'CONNECTED CUSTOMERS', '142')}
      ${statCard(332, 0, 'CONNECTED THIS WEEK', '18')}
      ${statCard(664, 0, 'POINTS AWARDED (30d)', '8,420')}
      ${statCard(996, 0, 'WISHLIST MATCHES', '—', 'Coming soon')}
    </g>

    <!-- Shopify panel (large) -->
    <g transform="translate(56, 304)">
      <rect width="800" height="440" rx="14" fill="${C.card}" stroke="${C.border}"/>
      <g transform="translate(28, 28)">
        <!-- Header with shopping bag icon + title + Live pill -->
        <circle cx="12" cy="12" r="12" fill="${C.green}" opacity="0.15"/>
        <text x="34" y="18" font-family="${FONT}" font-size="20" font-weight="700" fill="${C.text}">Shopify connected</text>
        <g transform="translate(280, 0)">
          <rect width="74" height="26" rx="13" fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.3)"/>
          <circle cx="16" cy="13" r="4" fill="${C.green}"/>
          <text x="28" y="17" font-family="${FONT}" font-size="12" font-weight="700" fill="${C.green}">Live</text>
        </g>

        <text x="0" y="52" font-family="${FONT}" font-size="14" fill="${C.muted}">
          <tspan font-weight="700" fill="${C.yellow}">Reddhill Games</tspan>
          <tspan fill="${C.muted}"> · </tspan>
          <tspan font-family="${MONO}" font-size="12" fill="${C.muted}">reddhill.myshopify.com</tspan>
          <tspan fill="${C.muted}"> · since 4/14/2026</tspan>
        </text>

        <!-- Settings sub-card -->
        <g transform="translate(0, 76)">
          <rect width="744" height="116" rx="10" fill="${C.bg}" stroke="${C.border}"/>
          <text x="20" y="30" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="2" fill="${C.muted}">SETTINGS</text>

          <g transform="translate(20, 48)">
            <text x="0" y="0" font-family="${FONT}" font-size="13" fill="${C.muted}">Points per $1 spent</text>
            <rect x="0" y="8" width="340" height="42" rx="6" fill="${C.card}" stroke="${C.border}"/>
            <text x="18" y="35" font-family="${FONT}" font-size="17" font-weight="600" fill="${C.text}">2</text>
          </g>
          <g transform="translate(384, 48)">
            <text x="0" y="0" font-family="${FONT}" font-size="13" fill="${C.muted}">Minimum order ($)</text>
            <rect x="0" y="8" width="340" height="42" rx="6" fill="${C.card}" stroke="${C.border}"/>
            <text x="18" y="35" font-family="${FONT}" font-size="17" font-weight="600" fill="${C.text}">0.00</text>
          </g>
        </g>

        <!-- Recent webhook activity -->
        <g transform="translate(0, 214)">
          <text x="0" y="0" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="2" fill="${C.muted}">RECENT WEBHOOK ACTIVITY</text>
          ${activityRow(0, 24, 'orders/paid', 'awarded · +24 pts', '2 min ago', C.green)}
          ${activityRow(0, 62, 'orders/paid', 'awarded · +84 pts', '14 min ago', C.green)}
          ${activityRow(0, 100, 'refunds/create', 'reversed · -12 pts', '1 hour ago', C.orange)}
          ${activityRow(0, 138, 'orders/paid', 'awarded · +52 pts', '3 hours ago', C.green)}
        </g>
      </g>
    </g>

    <!-- Right column: Customer lookup -->
    <g transform="translate(892, 304)">
      <rect width="652" height="440" rx="14" fill="${C.card}" stroke="${C.border}"/>
      <g transform="translate(28, 28)">
        <text x="0" y="18" font-family="${FONT}" font-size="18" font-weight="700" fill="${C.text}">Look up a customer</text>
        <text x="0" y="46" font-family="${FONT}" font-size="13" fill="${C.muted}">Scan their Passport QR or enter their 8-character code.</text>

        <!-- Search input -->
        <g transform="translate(0, 72)">
          <rect width="596" height="56" rx="10" fill="${C.bg}" stroke="${C.border}"/>
          <circle cx="26" cy="28" r="8" fill="none" stroke="${C.dim}" stroke-width="2"/>
          <line x1="32" y1="34" x2="38" y2="40" stroke="${C.dim}" stroke-width="2"/>
          <text x="56" y="35" font-family="${MONO}" font-size="16" font-weight="600" fill="${C.text}" letter-spacing="3">K7H3P2N4</text>
          <rect x="500" y="10" width="86" height="36" rx="6" fill="${C.orange}"/>
          <text x="543" y="33" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="800" fill="${C.bg}">Look up</text>
        </g>

        <!-- Identity card -->
        <g transform="translate(0, 160)">
          <rect width="596" height="72" rx="10" fill="${C.bg}" stroke="${C.border}"/>
          <circle cx="40" cy="36" r="20" fill="rgba(255,130,0,0.15)"/>
          <text x="40" y="42" text-anchor="middle" font-family="${FONT}" font-size="20" fill="${C.orange}">👤</text>
          <text x="78" y="32" font-family="${FONT}" font-size="16" font-weight="700" fill="${C.text}">Dana R.</text>
          <text x="78" y="54" font-family="${MONO}" font-size="12" fill="${C.muted}" letter-spacing="1">K7H3P2N4</text>
          <g transform="translate(500, 24)">
            <rect width="74" height="26" rx="13" fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.3)"/>
            <text x="37" y="17" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="700" fill="${C.green}">✓ Verified</text>
          </g>
        </g>

        <!-- Points card -->
        <g transform="translate(0, 250)">
          <rect width="596" height="124" rx="10" fill="${C.bg}" stroke="${C.border}"/>
          <text x="20" y="34" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="2" fill="${C.muted}">LOYALTY POINTS AT REDDHILL GAMES</text>
          <text x="20" y="82" font-family="${FONT}" font-size="36" font-weight="900" fill="${C.yellow}">340 points</text>
          <text x="20" y="106" font-family="${FONT}" font-size="12" font-style="italic" fill="${C.orange}">Your store only · Federated points across participating stores coming soon</text>
        </g>
      </g>
    </g>
  `, 'Dashboard — Shopify connected');
}

function statCard(x, y, label, value, sub) {
  return `
    <g transform="translate(${x}, ${y})">
      <rect width="316" height="112" rx="10" fill="${C.card}" stroke="${C.border}"/>
      <text x="20" y="32" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="2" fill="${C.muted}">${label}</text>
      <text x="20" y="80" font-family="${FONT}" font-size="36" font-weight="900" fill="${C.yellow}">${value}</text>
      ${sub ? `<text x="20" y="100" font-family="${FONT}" font-size="11" font-style="italic" fill="${C.dim}">${sub}</text>` : ''}
    </g>`;
}

function activityRow(x, y, topic, result, when, resultColor) {
  return `
    <g transform="translate(${x}, ${y})">
      <rect width="744" height="30" rx="6" fill="${C.card}"/>
      <text x="14" y="20" font-family="${FONT}" font-size="12" font-weight="600" fill="${C.text}">${topic}</text>
      <text x="260" y="20" font-family="${FONT}" font-size="12" fill="${resultColor}">${result}</text>
      <text x="728" y="20" text-anchor="end" font-family="${FONT}" font-size="12" fill="${C.dim}">${when}</text>
    </g>`;
}

// ----- 02. Consent QR generator -----
function consentQr() {
  return shellFrame(`
    <g transform="translate(56, 40)">
      <text x="0" y="0" font-family="${FONT}" font-size="12" font-weight="700" letter-spacing="3" fill="${C.orange}">CONNECT A NEW CUSTOMER</text>
      <text x="0" y="38" font-family="${FONT}" font-size="30" font-weight="900" fill="${C.yellow}">Generate a consent request</text>
      <text x="0" y="68" font-family="${FONT}" font-size="15" fill="${C.muted}">Pick what you're asking to access. Customer scans, signs in, approves.</text>
    </g>

    <!-- Left: scope checklist -->
    <g transform="translate(56, 140)">
      ${scopeRow(0, 0, true, '👤', 'Identity', 'Name, email, Passport code')}
      ${scopeRow(0, 76, true, '⭐', 'Wishlist', 'Games they want')}
      ${scopeRow(0, 152, false, '📚', 'Library', 'Games they own')}
      ${scopeRow(0, 228, false, '🏅', 'Badges &amp; reputation', 'Verified status')}
      ${scopeRow(0, 304, true, '🎯', 'Loyalty points', 'Award &amp; read your points')}

      <!-- Optional note input -->
      <g transform="translate(0, 400)">
        <rect width="720" height="44" rx="8" fill="${C.bg}" stroke="${C.border}"/>
        <text x="18" y="28" font-family="${FONT}" font-size="13" fill="${C.muted}">Loyalty signup at checkout</text>
      </g>

      <!-- Generate button -->
      <g transform="translate(0, 464)">
        <rect width="720" height="52" rx="8" fill="${C.orange}"/>
        <text x="360" y="33" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="800" fill="${C.bg}">Generate QR code</text>
      </g>
    </g>

    <!-- Right: what the customer will see (preview card) -->
    <g transform="translate(812, 140)">
      <rect width="720" height="552" rx="14" fill="${C.card}" stroke="${C.border}"/>
      <g transform="translate(32, 32)">
        <text x="0" y="14" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="2" fill="${C.muted}">CUSTOMER PREVIEW</text>

        <!-- QR placeholder -->
        <g transform="translate(168, 56)">
          <rect width="320" height="320" rx="12" fill="#ffffff"/>
          ${fakeQr(336, 336, 12)}
        </g>

        <text x="328" y="412" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="700" fill="${C.yellow}">Show this to your customer</text>
        <text x="328" y="436" text-anchor="middle" font-family="${FONT}" font-size="13" fill="${C.muted}">Expires in 14:52</text>
      </g>
    </g>
  `, 'Consent QR generator');
}

function scopeRow(x, y, on, icon, label, desc) {
  const bg = on ? 'rgba(255, 130, 0, 0.08)' : C.bg;
  const stroke = on ? C.orange : C.border;
  const checkColor = on ? C.orange : 'transparent';
  return `
    <g transform="translate(${x}, ${y})">
      <rect width="720" height="60" rx="8" fill="${bg}" stroke="${stroke}"/>
      <rect x="20" y="20" width="20" height="20" rx="4" fill="${checkColor}" stroke="${on ? C.orange : C.dim}" stroke-width="2"/>
      ${on ? '<path d="M 24 30 L 28 34 L 36 24" stroke="#0a0a0a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' : ''}
      <text x="56" y="36" font-family="${FONT}" font-size="20">${icon}</text>
      <text x="90" y="28" font-family="${FONT}" font-size="14" font-weight="700" fill="${C.text}">${label}</text>
      <text x="90" y="46" font-family="${FONT}" font-size="12" fill="${C.muted}">${desc}</text>
    </g>`;
}

function fakeQr(totalW, totalH, cell) {
  // Pseudo-QR pattern — random-looking grid of black cells. Not a real QR,
  // never will scan — that's the point (we're not leaking a real token).
  const cols = Math.floor(totalW / cell);
  const rows = Math.floor(totalH / cell);
  let out = '';
  // Three finder-pattern squares (top-left, top-right, bottom-left)
  const finder = (fx, fy) => `
    <rect x="${fx}" y="${fy}" width="${cell * 7}" height="${cell * 7}" fill="#0a0a0a"/>
    <rect x="${fx + cell}" y="${fy + cell}" width="${cell * 5}" height="${cell * 5}" fill="#ffffff"/>
    <rect x="${fx + cell * 2}" y="${fy + cell * 2}" width="${cell * 3}" height="${cell * 3}" fill="#0a0a0a"/>`;
  // Random fill
  // Deterministic pseudo-random so the image is stable
  const seed = (i, j) => ((i * 1103515245 + j * 12345) % 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if ((i < 7 && j < 7) || (i < 7 && j >= cols - 7) || (i >= rows - 7 && j < 7)) continue;
      if (seed(i + 1, j + 1) > 0.55) {
        out += `<rect x="${j * cell}" y="${i * cell}" width="${cell}" height="${cell}" fill="#0a0a0a"/>`;
      }
    }
  }
  out += finder(0, 0);
  out += finder((cols - 7) * cell, 0);
  out += finder(0, (rows - 7) * cell);
  return out;
}

// ----- 03. Customer lookup result with award buttons -----
function customerLookup() {
  return shellFrame(`
    <g transform="translate(56, 40)">
      <text x="0" y="0" font-family="${FONT}" font-size="12" font-weight="700" letter-spacing="3" fill="${C.orange}">REDDHILL GAMES</text>
      <text x="0" y="34" font-family="${FONT}" font-size="26" font-weight="900" fill="${C.yellow}">Dana R.</text>
      <text x="0" y="62" font-family="${MONO}" font-size="13" fill="${C.muted}" letter-spacing="1">K7H3P2N4 · member since 1/14/2026</text>
    </g>

    <!-- Badges strip -->
    <g transform="translate(56, 130)">
      <text x="0" y="0" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="2" fill="${C.muted}">BADGES</text>
      ${badge(0, 16, '🧭', 'Passport Pioneer', C.orange)}
      ${badge(224, 16, '🎨', 'Pollock Party 2026', C.yellow)}
      ${badge(464, 16, '🎲', "Fugly's Early Adopter", C.orange)}
    </g>

    <!-- Wishlist -->
    <g transform="translate(56, 230)">
      <text x="0" y="0" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="2" fill="${C.muted}">WISHLIST (6)</text>
      ${wishRow(0, 16, 'Spirit Island', 'Must have')}
      ${wishRow(0, 62, 'Frosthaven', 'Want')}
      ${wishRow(0, 108, 'Ark Nova: Marine Worlds', 'Want')}
      ${wishRow(0, 154, 'Arcs', 'Interested')}
    </g>

    <!-- Points panel with award UI -->
    <g transform="translate(880, 130)">
      <rect width="664" height="620" rx="14" fill="${C.card}" stroke="${C.border}"/>
      <g transform="translate(32, 32)">
        <text x="0" y="14" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="2" fill="${C.muted}">LOYALTY POINTS AT REDDHILL GAMES</text>
        <text x="0" y="74" font-family="${FONT}" font-size="52" font-weight="900" fill="${C.yellow}">340 points</text>

        <line x1="0" y1="112" x2="600" y2="112" stroke="${C.border}"/>

        <!-- Tabs -->
        <g transform="translate(0, 136)">
          <rect width="296" height="40" rx="6" fill="rgba(255,130,0,0.12)" stroke="${C.orange}"/>
          <text x="148" y="26" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="700" fill="${C.orange}">＋ Award</text>
          <rect x="304" width="296" height="40" rx="6" fill="transparent" stroke="${C.border}"/>
          <text x="452" y="26" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="700" fill="${C.muted}">− Redeem</text>
        </g>

        <!-- Quick amount buttons -->
        <g transform="translate(0, 200)">
          ${quickBtn(0, 0, '+5')}
          ${quickBtn(78, 0, '+10')}
          ${quickBtn(164, 0, '+25')}
          ${quickBtn(258, 0, '+50')}
        </g>

        <!-- Custom input + reason -->
        <g transform="translate(0, 266)">
          <rect width="120" height="44" rx="6" fill="${C.bg}" stroke="${C.border}"/>
          <text x="60" y="28" text-anchor="middle" font-family="${FONT}" font-size="13" fill="${C.muted}">Custom</text>
          <rect x="130" width="372" height="44" rx="6" fill="${C.bg}" stroke="${C.border}"/>
          <text x="146" y="28" font-family="${FONT}" font-size="13" fill="${C.muted}">Reason (optional)</text>
          <rect x="512" width="88" height="44" rx="6" fill="${C.orange}"/>
          <text x="556" y="28" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="800" fill="${C.bg}">Go</text>
        </g>

        <!-- Success message -->
        <g transform="translate(0, 340)">
          <rect width="600" height="56" rx="8" fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.3)"/>
          <circle cx="32" cy="28" r="10" fill="${C.green}"/>
          <path d="M 27 28 L 31 32 L 38 23" stroke="#0a0a0a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <text x="56" y="33" font-family="${FONT}" font-size="14" fill="${C.green}">+10 pts · new balance 340</text>
        </g>
      </g>
    </g>
  `, 'Customer lookup');
}

function badge(x, y, emoji, label, color) {
  return `
    <g transform="translate(${x}, ${y})">
      <rect width="220" height="44" rx="22" fill="rgba(0,0,0,0.3)" stroke="${color}" stroke-opacity="0.3"/>
      <text x="20" y="29" font-family="${FONT}" font-size="18">${emoji}</text>
      <text x="50" y="29" font-family="${FONT}" font-size="13" font-weight="600" fill="${color}">${label}</text>
    </g>`;
}

function wishRow(x, y, title, priority) {
  return `
    <g transform="translate(${x}, ${y})">
      <rect width="760" height="36" rx="6" fill="${C.card}"/>
      <text x="16" y="24" font-family="${FONT}" font-size="13" font-weight="600" fill="${C.text}">${title}</text>
      <text x="744" y="24" text-anchor="end" font-family="${FONT}" font-size="11" fill="${C.dim}">${priority}</text>
    </g>`;
}

function quickBtn(x, y, label) {
  return `
    <g transform="translate(${x}, ${y})">
      <rect width="68" height="38" rx="6" fill="${C.bg}" stroke="${C.border}"/>
      <text x="34" y="25" text-anchor="middle" font-family="${MONO}" font-size="14" font-weight="700" fill="${C.yellow}">${label}</text>
    </g>`;
}

// ----- 04. Points award action (before/after flow) -----
function pointsAward() {
  return shellFrame(`
    <g transform="translate(56, 40)">
      <text x="0" y="0" font-family="${FONT}" font-size="12" font-weight="700" letter-spacing="3" fill="${C.orange}">REWARD A PURCHASE</text>
      <text x="0" y="38" font-family="${FONT}" font-size="30" font-weight="900" fill="${C.yellow}">Award points in one tap</text>
      <text x="0" y="68" font-family="${FONT}" font-size="15" fill="${C.muted}">Quick buttons for common amounts. Custom values with optional reason.</text>
    </g>

    <!-- Award flow sequence -->
    <g transform="translate(56, 170)">
      <!-- Step 1 -->
      <g>
        <rect width="460" height="560" rx="14" fill="${C.card}" stroke="${C.border}"/>
        <text x="24" y="44" font-family="${FONT}" font-size="13" font-weight="700" letter-spacing="2" fill="${C.orange}">1 · LOOK UP</text>
        <rect x="24" y="72" width="412" height="48" rx="8" fill="${C.bg}" stroke="${C.border}"/>
        <text x="40" y="103" font-family="${MONO}" font-size="15" font-weight="600" fill="${C.text}" letter-spacing="3">K7H3P2N4</text>

        <!-- Result -->
        <g transform="translate(24, 152)">
          <rect width="412" height="72" rx="10" fill="${C.bg}" stroke="${C.border}"/>
          <text x="20" y="32" font-family="${FONT}" font-size="15" font-weight="700" fill="${C.text}">Dana R.</text>
          <text x="20" y="54" font-family="${MONO}" font-size="11" fill="${C.muted}" letter-spacing="1">K7H3P2N4</text>
        </g>

        <g transform="translate(24, 256)">
          <rect width="412" height="100" rx="10" fill="${C.bg}" stroke="${C.border}"/>
          <text x="20" y="36" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="2" fill="${C.muted}">CURRENT BALANCE</text>
          <text x="20" y="80" font-family="${FONT}" font-size="36" font-weight="900" fill="${C.yellow}">330 points</text>
        </g>
      </g>

      <!-- Arrow -->
      <g transform="translate(490, 276)">
        <path d="M 0 0 L 64 0 M 54 -8 L 64 0 L 54 8"
              stroke="${C.orange}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g>

      <!-- Step 2 -->
      <g transform="translate(594, 0)">
        <rect width="460" height="560" rx="14" fill="${C.card}" stroke="${C.border}"/>
        <text x="24" y="44" font-family="${FONT}" font-size="13" font-weight="700" letter-spacing="2" fill="${C.orange}">2 · AWARD</text>

        <g transform="translate(24, 72)">
          ${quickBtn(0, 0, '+5')}
          ${quickBtn(86, 0, '+10')}
          ${quickBtn(172, 0, '+25')}
          ${quickBtn(258, 0, '+50')}
        </g>

        <g transform="translate(24, 132)">
          <rect width="412" height="52" rx="8" fill="${C.bg}" stroke="${C.border}"/>
          <text x="20" y="32" font-family="${FONT}" font-size="13" fill="${C.muted}">Bonus for in-store event check-in</text>
        </g>

        <g transform="translate(24, 208)">
          <rect width="412" height="52" rx="8" fill="${C.orange}"/>
          <text x="230" y="34" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="800" fill="${C.bg}">Go</text>
        </g>
      </g>

      <!-- Arrow -->
      <g transform="translate(1084, 276)">
        <path d="M 0 0 L 64 0 M 54 -8 L 64 0 L 54 8"
              stroke="${C.green}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g>

      <!-- Step 3 -->
      <g transform="translate(1188, 0)">
        <rect width="352" height="560" rx="14" fill="${C.card}" stroke="rgba(16,185,129,0.4)"/>
        <text x="24" y="44" font-family="${FONT}" font-size="13" font-weight="700" letter-spacing="2" fill="${C.green}">3 · CREDITED</text>

        <g transform="translate(24, 72)">
          <rect width="304" height="100" rx="10" fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.3)"/>
          <text x="20" y="36" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="2" fill="${C.green}">NEW BALANCE</text>
          <text x="20" y="80" font-family="${FONT}" font-size="36" font-weight="900" fill="${C.yellow}">340 points</text>
        </g>

        <g transform="translate(24, 196)">
          <rect width="304" height="52" rx="8" fill="${C.bg}" stroke="${C.border}"/>
          <text x="20" y="33" font-family="${FONT}" font-size="13" fill="${C.green}">+10 pts awarded · logged</text>
        </g>
      </g>
    </g>
  `, 'Award points');
}

// ----- 05. Passport settings — customer view of connected stores -----
function passportSettings() {
  return shellFrame(`
    <g transform="translate(56, 40)">
      <text x="0" y="0" font-family="${FONT}" font-size="12" font-weight="700" letter-spacing="3" fill="${C.orange}">YOUR PASSPORT</text>
      <text x="0" y="38" font-family="${FONT}" font-size="30" font-weight="900" fill="${C.yellow}">Connected stores &amp; creators</text>
      <text x="0" y="68" font-family="${FONT}" font-size="15" fill="${C.muted}">Stores and creators you've granted access. Revoke any time — they lose access immediately.</text>
    </g>

    <!-- Connected stores list -->
    <g transform="translate(56, 170)">
      ${connectedStore(0, 0, 'Reddhill Games', 'store · Madison, WI', '2 days ago', ['identity', 'wishlist', 'points'], 340)}
      ${connectedStore(0, 176, "Level Up Games", 'store · Greensboro, NC', '2 weeks ago', ['identity', 'points'], 1280)}
      ${connectedStore(0, 352, 'The Painter\'s Guild', 'venue · Austin, TX', '1 month ago', ['identity', 'badges'], null)}
    </g>

    <!-- Right column: points earned summary -->
    <g transform="translate(1076, 170)">
      <rect width="468" height="528" rx="14" fill="${C.card}" stroke="${C.border}"/>
      <g transform="translate(28, 28)">
        <text x="0" y="14" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="2" fill="${C.muted}">LIFETIME POINTS EARNED</text>
        <text x="0" y="80" font-family="${FONT}" font-size="56" font-weight="900" fill="${C.yellow}">1,620</text>
        <text x="0" y="110" font-family="${FONT}" font-size="13" fill="${C.muted}">across 2 stores</text>

        <line x1="0" y1="148" x2="412" y2="148" stroke="${C.border}"/>

        <text x="0" y="184" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="2" fill="${C.muted}">BY STORE</text>
        ${pointsRow(0, 208, 'Level Up Games', '1,280')}
        ${pointsRow(0, 256, 'Reddhill Games', '340')}

        <line x1="0" y1="316" x2="412" y2="316" stroke="${C.border}"/>

        <text x="0" y="352" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="2" fill="${C.muted}">RECENT</text>
        ${recentPoint(0, 376, '+84 pts · Reddhill Games', '2 min ago')}
        ${recentPoint(0, 414, '+120 pts · Level Up Games', 'yesterday')}
        ${recentPoint(0, 452, '+42 pts · Reddhill Games', '3 days ago')}
      </g>
    </g>
  `, 'Connected stores');
}

function connectedStore(x, y, name, sub, when, scopes, points) {
  const scopeChips = scopes.map((s, i) => `
    <g transform="translate(${i * 104}, 0)">
      <rect width="92" height="22" rx="11" fill="rgba(255,130,0,0.1)" stroke="rgba(255,130,0,0.3)"/>
      <text x="46" y="15" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="600" fill="${C.orange}">${s}</text>
    </g>`).join('');

  return `
    <g transform="translate(${x}, ${y})">
      <rect width="1000" height="152" rx="12" fill="${C.card}" stroke="rgba(16,185,129,0.3)"/>
      <g transform="translate(28, 24)">
        <text x="0" y="18" font-family="${FONT}" font-size="18" font-weight="700" fill="${C.text}">${name}</text>
        <text x="0" y="42" font-family="${FONT}" font-size="13" fill="${C.muted}">${sub} · since ${when}</text>
        <g transform="translate(0, 60)">${scopeChips}</g>
      </g>
      ${points != null ? `
      <g transform="translate(780, 36)">
        <text x="120" y="36" text-anchor="end" font-family="${FONT}" font-size="28" font-weight="900" fill="${C.yellow}">${points}</text>
        <text x="120" y="58" text-anchor="end" font-family="${FONT}" font-size="11" letter-spacing="2" fill="${C.muted}">POINTS</text>
      </g>
      ` : ''}
      <g transform="translate(880, 106)">
        <rect width="92" height="28" rx="14" fill="transparent" stroke="${C.red}"/>
        <text x="46" y="19" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="700" fill="${C.red}">Revoke</text>
      </g>
    </g>`;
}

function pointsRow(x, y, name, value) {
  return `
    <g transform="translate(${x}, ${y})">
      <text x="0" y="16" font-family="${FONT}" font-size="14" fill="${C.text}">${name}</text>
      <text x="412" y="16" text-anchor="end" font-family="${FONT}" font-size="14" font-weight="700" fill="${C.yellow}">${value}</text>
    </g>`;
}

function recentPoint(x, y, label, when) {
  return `
    <g transform="translate(${x}, ${y})">
      <text x="0" y="16" font-family="${FONT}" font-size="12" fill="${C.text}">${label}</text>
      <text x="412" y="16" text-anchor="end" font-family="${FONT}" font-size="12" fill="${C.dim}">${when}</text>
    </g>`;
}

// ----- Render all -----
async function render(name, svg) {
  const outPath = path.join(OUT_DIR, `${name}.png`);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).resize(W, H).toFile(outPath);
  const { stat } = await import('fs/promises');
  const s = await stat(outPath);
  console.log(`  ${name}.png — ${(s.size / 1024).toFixed(0)} KB`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Rendering 5 screenshots at ${W}×${H}:`);
  await render('01-dashboard', dashboard());
  await render('02-consent-qr', consentQr());
  await render('03-customer-lookup', customerLookup());
  await render('04-points-award', pointsAward());
  await render('05-passport-settings', passportSettings());
  console.log('\nAll screenshots ready in scripts/out/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
