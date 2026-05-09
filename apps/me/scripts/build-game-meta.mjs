// Build apps/me/lib/heimdall/game-meta.json from the BGG dump.
//
// Joins:
//   - apps/me/lib/heimdall/game-names.json (id → name, the slim corpus lookup)
//   - rec-engines/mimir/tmp/bgg_deep.json (BGG metadata for ~2600 games)
//
// Outputs:
//   apps/me/lib/heimdall/game-meta.json
//     { "<id>": { name, year, subdomain, categories: [up to 3 strings] } }
//
// `subdomain` is the BGG top-level genre bucket (Strategy / Family /
// Party / Thematic / Wargame / Customizable / Children / Abstract).
// We pick the first non-"Overall" entry from bggSubdomains.
//
// `categories` is normalized to up to 3 strings (handles both string-
// array and {id, value}-object-array formats present in the dump).
//
// Run from apps/me/:
//   node scripts/build-game-meta.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.resolve(__dirname, '..', '..', '..'); // ops-afterroar-store
const NAMES_PATH = path.join(__dirname, '..', 'lib', 'heimdall', 'game-names.json');
const META_PATH = path.join(__dirname, '..', 'lib', 'heimdall', 'game-meta.json');
const BGG_DUMP_PATH = path.join(REPO, 'rec-engines', 'mimir', 'tmp', 'bgg_deep.json');

function normCategories(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      if (typeof c === 'string') return c;
      if (c && typeof c === 'object' && typeof c.value === 'string') return c.value;
      return null;
    })
    .filter((c) => c && c.length > 0);
}

function pickSubdomain(raw) {
  if (!Array.isArray(raw)) return null;
  // Skip 'Overall' — it's redundant. Take the first remaining entry.
  for (const s of raw) {
    if (typeof s !== 'string') continue;
    if (s === 'Overall') continue;
    // 'Strategy Games' → 'Strategy', etc.
    return s.replace(/\s+Games?$/i, '');
  }
  return null;
}

function main() {
  if (!fs.existsSync(BGG_DUMP_PATH)) {
    console.error('BGG dump not found at', BGG_DUMP_PATH);
    process.exit(1);
  }
  const names = JSON.parse(fs.readFileSync(NAMES_PATH, 'utf8'));
  const dump = JSON.parse(fs.readFileSync(BGG_DUMP_PATH, 'utf8'));
  const dumpById = new Map();
  for (const g of dump) dumpById.set(g.id, g);

  const meta = {};
  let withSubdomain = 0;
  let withCategories = 0;
  let withYear = 0;
  let missingInDump = 0;

  for (const [idStr, name] of Object.entries(names)) {
    const id = Number(idStr);
    const g = dumpById.get(id);
    if (!g) {
      // Game in seidr corpus but not in dump — keep name only.
      meta[idStr] = { name };
      missingInDump++;
      continue;
    }
    const subdomain = pickSubdomain(g.bggSubdomains);
    const categories = normCategories(g.categories).slice(0, 3);
    const entry = {
      name: g.name || name,
      year: typeof g.year === 'number' ? g.year : null,
      subdomain,
      categories,
    };
    if (subdomain) withSubdomain++;
    if (categories.length) withCategories++;
    if (entry.year) withYear++;
    meta[idStr] = entry;
  }

  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
  console.log(
    `Wrote ${Object.keys(meta).length} entries to game-meta.json:\n` +
      `  - ${withYear} with year\n` +
      `  - ${withSubdomain} with subdomain\n` +
      `  - ${withCategories} with at least one category\n` +
      `  - ${missingInDump} missing from dump (kept name only)`,
  );
}

main();
